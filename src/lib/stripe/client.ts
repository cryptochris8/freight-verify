import Stripe from "stripe";
import { db } from "@/lib/db";
import { subscriptions, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PLAN_TIERS, type PlanTier } from "./plans";
export { PLAN_TIERS, type PlanTier };

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

/**
 * Resolves the Stripe price ID for a given tier.
 * Uses env vars: STRIPE_PRICE_STARTER, STRIPE_PRICE_PROFESSIONAL, STRIPE_PRICE_BUSINESS
 */
function getPriceIdForTier(tier: PlanTier): string {
  const envMap: Record<PlanTier, string> = {
    starter: process.env.STRIPE_PRICE_STARTER ?? "price_starter",
    professional: process.env.STRIPE_PRICE_PROFESSIONAL ?? "price_professional",
    business: process.env.STRIPE_PRICE_BUSINESS ?? "price_business",
  };
  return envMap[tier];
}

/**
 * Gets or creates a Stripe customer for an organization.
 */
async function getOrCreateCustomer(orgId: string): Promise<string> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (org?.stripeCustomerId) {
    return org.stripeCustomerId;
  }

  const customer = await getStripe().customers.create({
    name: org?.name ?? "Organization",
    metadata: { orgId },
  });

  await db
    .update(organizations)
    .set({ stripeCustomerId: customer.id })
    .where(eq(organizations.id, orgId));

  return customer.id;
}

/**
 * Creates a Stripe Checkout Session for subscribing to a plan.
 * Includes a 14-day free trial.
 */
export async function createCheckoutSession(
  orgId: string,
  tier: PlanTier
): Promise<{ url: string | null }> {
  const customerId = await getOrCreateCustomer(orgId);
  const priceId = getPriceIdForTier(tier);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { orgId, tier },
    },
    success_url: `${appUrl}/settings?billing=success`,
    cancel_url: `${appUrl}/settings?billing=canceled`,
    metadata: { orgId, tier },
  });

  return { url: session.url };
}

/**
 * Creates a Stripe Customer Portal session for managing subscriptions.
 */
export async function createPortalSession(
  orgId: string
): Promise<{ url: string }> {
  const customerId = await getOrCreateCustomer(orgId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/settings`,
  });

  return { url: session.url };
}

/**
 * Returns the current subscription for an organization.
 */
export async function getSubscription(orgId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);

  return sub ?? null;
}

/**
 * Upserts a subscription record from Stripe webhook data.
 */
export async function upsertSubscription(
  orgId: string,
  stripeSubscription: Stripe.Subscription,
  tier: PlanTier
) {
  const existing = await getSubscription(orgId);

  const values = {
    orgId,
    stripeSubscriptionId: stripeSubscription.id,
    stripeCustomerId:
      typeof stripeSubscription.customer === "string"
        ? stripeSubscription.customer
        : stripeSubscription.customer.id,
    stripePriceId: stripeSubscription.items.data[0]?.price.id ?? null,
    planTier: tier,
    status: stripeSubscription.status as "trialing" | "active" | "past_due" | "canceled" | "unpaid",
    trialEndsAt: stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000)
      : null,
    currentPeriodStart: new Date(stripeSubscription.items.data[0]?.current_period_start
      ? stripeSubscription.items.data[0].current_period_start * 1000
      : Date.now()),
    currentPeriodEnd: new Date(stripeSubscription.items.data[0]?.current_period_end
      ? stripeSubscription.items.data[0].current_period_end * 1000
      : Date.now()),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(subscriptions)
      .set(values)
      .where(eq(subscriptions.orgId, orgId));
  } else {
    await db.insert(subscriptions).values(values);
  }

  // Update org plan
  await db
    .update(organizations)
    .set({
      plan: tier,
      verifiedLoadsLimit: PLAN_TIERS[tier].loadLimit,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
}
