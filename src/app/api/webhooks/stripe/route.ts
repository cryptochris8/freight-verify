import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe, upsertSubscription, type PlanTier } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { subscriptions, organizations, stripeWebhookEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("STRIPE", "STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("STRIPE", "Webhook signature verification failed", { error: message });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: insert the event record BEFORE processing.
  // If a concurrent request already inserted it, the unique constraint
  // on stripeEventId will throw and we skip processing (dedup).
  try {
    await db.insert(stripeWebhookEvents).values({
      stripeEventId: event.id,
      eventType: event.type,
    });
  } catch (insertError) {
    // Unique constraint violation means this event was already claimed
    const msg = insertError instanceof Error ? insertError.message : "";
    if (msg.includes("unique") || msg.includes("duplicate") || msg.includes("23505")) {
      return NextResponse.json({ received: true });
    }
    throw insertError;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        const tier = (session.metadata?.tier ?? "starter") as PlanTier;

        if (orgId && session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const stripeSubscription = await getStripe().subscriptions.retrieve(subscriptionId);
          await upsertSubscription(orgId, stripeSubscription, tier);
          logger.info("STRIPE", "Checkout completed", { orgId, tier });
        }
        break;
      }

      case "customer.subscription.updated": {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        const orgId = stripeSubscription.metadata?.orgId;
        const tier = (stripeSubscription.metadata?.tier ?? "starter") as PlanTier;

        if (orgId) {
          await upsertSubscription(orgId, stripeSubscription, tier);
          logger.info("STRIPE", "Subscription updated", { orgId, status: stripeSubscription.status });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        const orgId = stripeSubscription.metadata?.orgId;

        if (orgId) {
          await db
            .update(subscriptions)
            .set({ status: "canceled", updatedAt: new Date() })
            .where(eq(subscriptions.orgId, orgId));

          await db
            .update(organizations)
            .set({ plan: "starter", verifiedLoadsLimit: 50, updatedAt: new Date() })
            .where(eq(organizations.id, orgId));

          logger.info("STRIPE", "Subscription deleted", { orgId });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

        if (customerId) {
          const [org] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.stripeCustomerId, customerId))
            .limit(1);

          if (org) {
            await db
              .update(subscriptions)
              .set({ status: "past_due", updatedAt: new Date() })
              .where(eq(subscriptions.orgId, org.id));

            logger.info("STRIPE", "Payment failed", { orgId: org.id, invoiceId: invoice.id });
          }
        }
        break;
      }

      default:
        logger.info("STRIPE", "Unhandled event type", { eventType: event.type });
    }
  } catch (error) {
    logger.error("STRIPE", "Webhook processing failed", { eventType: event.type, error: String(error) });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
