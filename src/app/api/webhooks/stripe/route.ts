import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe, upsertSubscription, type PlanTier } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { subscriptions, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
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
          console.log(`[STRIPE] Checkout completed for org ${orgId}, tier ${tier}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        const orgId = stripeSubscription.metadata?.orgId;
        const tier = (stripeSubscription.metadata?.tier ?? "starter") as PlanTier;

        if (orgId) {
          await upsertSubscription(orgId, stripeSubscription, tier);
          console.log(`[STRIPE] Subscription updated for org ${orgId}, status: ${stripeSubscription.status}`);
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

          console.log(`[STRIPE] Subscription deleted for org ${orgId}`);
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

            console.log(`[STRIPE] Payment failed for org ${org.id}, invoice ${invoice.id}`);
          }
        }
        break;
      }

      default:
        console.log(`[STRIPE] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[STRIPE] Error processing webhook ${event.type}:`, error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
