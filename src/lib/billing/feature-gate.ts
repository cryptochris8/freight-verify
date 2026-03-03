import { db } from "@/lib/db";
import { subscriptions, loads, carriers, organizations } from "@/lib/db/schema";
import { eq, and, count, gte } from "drizzle-orm";
import { PLAN_TIERS, type PlanTier } from "@/lib/stripe/plans";
import { startOfMonth } from "date-fns";

export type Feature = "loadLimit" | "userLimit" | "carrierLimit" | "smsAlerts" | "apiAccess";

interface AccessResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
  tier: PlanTier;
}

/**
 * Gets the current subscription tier for an organization.
 * Defaults to 'starter' if no subscription exists.
 */
async function getOrgTier(orgId: string): Promise<PlanTier> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);

  if (!sub) return "starter";

  // If subscription is canceled or unpaid, fall back to starter
  if (sub.status === "canceled" || sub.status === "unpaid") {
    return "starter";
  }

  return sub.planTier as PlanTier;
}

/**
 * Checks whether an organization has access to a given feature
 * based on their subscription tier.
 */
export async function checkAccess(
  orgId: string,
  feature: Feature
): Promise<AccessResult> {
  const tier = await getOrgTier(orgId);
  const planConfig = PLAN_TIERS[tier];

  switch (feature) {
    case "loadLimit": {
      const usage = await getMonthlyLoadCount(orgId);
      const limit = planConfig.loadLimit;
      return {
        allowed: usage < limit,
        currentUsage: usage,
        limit,
        tier,
        reason: usage >= limit
          ? `You have reached your monthly limit of ${limit} verified loads. Upgrade to increase your limit.`
          : undefined,
      };
    }

    case "userLimit": {
      const limit = planConfig.userLimit;
      return {
        allowed: true, // User limit is enforced at the Clerk level
        limit: limit === Infinity ? undefined : limit,
        tier,
      };
    }

    case "carrierLimit": {
      const usage = await getCarrierCount(orgId);
      const limit = planConfig.carrierLimit;
      return {
        allowed: limit === Infinity || usage < limit,
        currentUsage: usage,
        limit: limit === Infinity ? undefined : limit,
        tier,
        reason:
          limit !== Infinity && usage >= limit
            ? `You have reached your carrier limit of ${limit}. Upgrade to add more carriers.`
            : undefined,
      };
    }

    case "smsAlerts": {
      return {
        allowed: planConfig.smsAlerts,
        tier,
        reason: !planConfig.smsAlerts
          ? "SMS alerts are available on Professional and Business plans."
          : undefined,
      };
    }

    case "apiAccess": {
      return {
        allowed: planConfig.apiAccess,
        tier,
        reason: !planConfig.apiAccess
          ? "API access is available on Professional and Business plans."
          : undefined,
      };
    }

    default:
      return { allowed: true, tier };
  }
}

/**
 * Checks if the organization's trial period is still active.
 */
export async function isTrialActive(orgId: string): Promise<{
  active: boolean;
  daysRemaining: number;
  endsAt: Date | null;
}> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);

  if (!sub || !sub.trialEndsAt) {
    return { active: false, daysRemaining: 0, endsAt: null };
  }

  const now = new Date();
  const trialEnd = new Date(sub.trialEndsAt);
  const active = sub.status === "trialing" && trialEnd > now;
  const daysRemaining = active
    ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return { active, daysRemaining, endsAt: trialEnd };
}

/**
 * Returns current month's usage statistics for an organization.
 */
export async function getUsage(orgId: string): Promise<{
  loadsThisMonth: number;
  loadLimit: number;
  carrierCount: number;
  carrierLimit: number | null;
  tier: PlanTier;
}> {
  const tier = await getOrgTier(orgId);
  const planConfig = PLAN_TIERS[tier];
  const loadsThisMonth = await getMonthlyLoadCount(orgId);
  const carrierCount = await getCarrierCount(orgId);

  return {
    loadsThisMonth,
    loadLimit: planConfig.loadLimit,
    carrierCount,
    carrierLimit: planConfig.carrierLimit === Infinity ? null : planConfig.carrierLimit,
    tier,
  };
}

async function getMonthlyLoadCount(orgId: string): Promise<number> {
  const monthStart = startOfMonth(new Date());
  const [result] = await db
    .select({ value: count() })
    .from(loads)
    .where(and(eq(loads.orgId, orgId), gte(loads.createdAt, monthStart)));
  return result?.value ?? 0;
}

async function getCarrierCount(orgId: string): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(carriers)
    .where(eq(carriers.orgId, orgId));
  return result?.value ?? 0;
}
