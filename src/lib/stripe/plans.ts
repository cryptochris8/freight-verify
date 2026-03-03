/**
 * Plan tier configuration - safe for both client and server components.
 * Does NOT import any server-only modules (db, postgres, etc).
 */

export const PLAN_TIERS = {
  starter: {
    name: "Starter",
    price: 14900,
    priceDisplay: "$149",
    loadLimit: 50,
    userLimit: 3,
    carrierLimit: 25,
    smsAlerts: false,
    apiAccess: false,
    features: [
      "50 verified loads/month",
      "3 team members",
      "25 carriers",
      "Email alerts",
      "Chain of custody log",
      "FMCSA verification",
    ],
  },
  professional: {
    name: "Professional",
    price: 39900,
    priceDisplay: "$399",
    loadLimit: 200,
    userLimit: 10,
    carrierLimit: Infinity,
    smsAlerts: true,
    apiAccess: true,
    features: [
      "200 verified loads/month",
      "10 team members",
      "Unlimited carriers",
      "SMS + email alerts",
      "API access",
      "Priority email support",
    ],
  },
  business: {
    name: "Business",
    price: 79900,
    priceDisplay: "$799",
    loadLimit: 500,
    userLimit: Infinity,
    carrierLimit: Infinity,
    smsAlerts: true,
    apiAccess: true,
    features: [
      "500 verified loads/month",
      "Unlimited team members",
      "Unlimited carriers",
      "SMS + email alerts",
      "API access",
      "Priority phone + email support",
      "Dedicated account manager",
    ],
  },
} as const;

export type PlanTier = keyof typeof PLAN_TIERS;
