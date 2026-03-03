"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { organizations, subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  createCheckoutSession as stripeCheckout,
  createPortalSession as stripePortal,
  getSubscription,
  type PlanTier,
  PLAN_TIERS,
} from "@/lib/stripe/client";
import { getUsage, isTrialActive } from "@/lib/billing/feature-gate";

export async function createCheckoutSessionAction(tier: PlanTier) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { success: false as const, error: "Unauthorized" };
  }

  // Resolve internal org ID from Clerk orgId
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, orgId))
    .limit(1);

  if (!org) {
    return { success: false as const, error: "Organization not found" };
  }

  try {
    const session = await stripeCheckout(org.id, tier);
    return { success: true as const, url: session.url };
  } catch (error) {
    console.error("[BILLING] Checkout session error:", error);
    return { success: false as const, error: "Failed to create checkout session" };
  }
}

export async function createPortalSessionAction() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { success: false as const, error: "Unauthorized" };
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, orgId))
    .limit(1);

  if (!org) {
    return { success: false as const, error: "Organization not found" };
  }

  try {
    const session = await stripePortal(org.id);
    return { success: true as const, url: session.url };
  } catch (error) {
    console.error("[BILLING] Portal session error:", error);
    return { success: false as const, error: "Failed to create portal session" };
  }
}

export async function getSubscriptionStatus() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return null;
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.clerkOrgId, orgId))
    .limit(1);

  if (!org) return null;

  const subscription = await getSubscription(org.id);
  const usage = await getUsage(org.id);
  const trial = await isTrialActive(org.id);

  return {
    subscription: subscription
      ? {
          id: subscription.id,
          planTier: subscription.planTier,
          status: subscription.status,
          trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
    usage,
    trial,
    planDetails: PLAN_TIERS[usage.tier],
  };
}
