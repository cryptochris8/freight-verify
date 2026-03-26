import { describe, it, expect, vi, beforeEach } from "vitest";

// Track which queries are called — same pattern as feature-gate.test.ts
let queryResults: unknown[][] = [];
let queryIndex = 0;

vi.mock("@/lib/db", () => {
  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const resolve = () => {
      const result = queryResults[queryIndex] ?? [];
      queryIndex++;
      return Promise.resolve(result);
    };
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockImplementation(() => {
      const thenableChain = {
        limit: vi.fn().mockImplementation(resolve),
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
          return resolve().then(onFulfilled, onRejected);
        },
      };
      return thenableChain;
    });
    return chain;
  };

  return {
    db: {
      select: vi.fn().mockImplementation(() => makeChain()),
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  subscriptions: {},
  loads: {},
  carriers: {},
  organizations: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  count: vi.fn().mockReturnValue("count"),
  gte: vi.fn(),
}));

vi.mock("date-fns", () => ({
  startOfMonth: vi.fn().mockReturnValue(new Date("2026-03-01")),
}));

vi.mock("@/lib/stripe/plans", () => ({
  PLAN_TIERS: {
    starter: {
      loadLimit: 50,
      userLimit: 3,
      carrierLimit: 25,
      smsAlerts: false,
      apiAccess: false,
    },
    professional: {
      loadLimit: 200,
      userLimit: 10,
      carrierLimit: Infinity,
      smsAlerts: true,
      apiAccess: true,
    },
    business: {
      loadLimit: 500,
      userLimit: Infinity,
      carrierLimit: Infinity,
      smsAlerts: true,
      apiAccess: true,
    },
  },
}));

import { isTrialActive, getUsage } from "@/lib/billing/feature-gate";

describe("isTrialActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults = [];
  });

  it("returns inactive with zero days when no subscription exists", async () => {
    queryResults = [[]]; // no subscription row

    const result = await isTrialActive("org-1");

    expect(result).toEqual({ active: false, daysRemaining: 0, endsAt: null });
  });

  it("returns inactive when subscription exists but status is not trialing", async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    queryResults = [
      [{ status: "active", trialEndsAt: futureDate.toISOString() }],
    ];

    const result = await isTrialActive("org-1");

    expect(result.active).toBe(false);
    expect(result.daysRemaining).toBe(0);
    expect(result.endsAt).toBeInstanceOf(Date);
  });

  it("returns active with correct daysRemaining when trialing and trial has not ended", async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
    queryResults = [
      [{ status: "trialing", trialEndsAt: futureDate.toISOString() }],
    ];

    const result = await isTrialActive("org-1");

    expect(result.active).toBe(true);
    // Math.ceil on ~5 days — allow for 4–5 due to timing
    expect(result.daysRemaining).toBeGreaterThanOrEqual(4);
    expect(result.daysRemaining).toBeLessThanOrEqual(5);
    expect(result.endsAt).toBeInstanceOf(Date);
  });

  it("returns inactive when trial end date is in the past", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    queryResults = [
      [{ status: "trialing", trialEndsAt: pastDate.toISOString() }],
    ];

    const result = await isTrialActive("org-1");

    expect(result.active).toBe(false);
    expect(result.daysRemaining).toBe(0);
    expect(result.endsAt).toBeInstanceOf(Date);
  });

  it("returns inactive with null endsAt when subscription has no trialEndsAt", async () => {
    queryResults = [
      [{ status: "trialing", trialEndsAt: null }],
    ];

    const result = await isTrialActive("org-1");

    expect(result).toEqual({ active: false, daysRemaining: 0, endsAt: null });
  });
});

describe("getUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults = [];
  });

  it("returns correct usage for starter tier (no subscription)", async () => {
    queryResults = [
      [],              // getOrgTier → no subscription → starter
      [{ value: 12 }], // getMonthlyLoadCount
      [{ value: 8 }],  // getCarrierCount
    ];

    const result = await getUsage("org-1");

    expect(result.tier).toBe("starter");
    expect(result.loadsThisMonth).toBe(12);
    expect(result.loadLimit).toBe(50);
    expect(result.carrierCount).toBe(8);
    expect(result.carrierLimit).toBe(25);
  });

  it("returns correct usage for professional tier", async () => {
    queryResults = [
      [{ planTier: "professional", status: "active" }], // getOrgTier
      [{ value: 75 }],                                   // getMonthlyLoadCount
      [{ value: 300 }],                                  // getCarrierCount
    ];

    const result = await getUsage("org-1");

    expect(result.tier).toBe("professional");
    expect(result.loadsThisMonth).toBe(75);
    expect(result.loadLimit).toBe(200);
    expect(result.carrierCount).toBe(300);
    // professional has Infinity carrierLimit → should return null
    expect(result.carrierLimit).toBeNull();
  });

  it("returns null carrierLimit for business tier", async () => {
    queryResults = [
      [{ planTier: "business", status: "active" }], // getOrgTier
      [{ value: 400 }],                              // getMonthlyLoadCount
      [{ value: 1000 }],                             // getCarrierCount
    ];

    const result = await getUsage("org-1");

    expect(result.tier).toBe("business");
    expect(result.loadLimit).toBe(500);
    expect(result.carrierLimit).toBeNull();
  });

  it("returns zero counts when no loads or carriers exist", async () => {
    queryResults = [
      [],              // getOrgTier → starter
      [{ value: 0 }],  // getMonthlyLoadCount
      [{ value: 0 }],  // getCarrierCount
    ];

    const result = await getUsage("org-1");

    expect(result.loadsThisMonth).toBe(0);
    expect(result.carrierCount).toBe(0);
  });

  it("falls back to starter when subscription is canceled", async () => {
    queryResults = [
      [{ planTier: "professional", status: "canceled" }], // canceled → starter
      [{ value: 30 }],
      [{ value: 15 }],
    ];

    const result = await getUsage("org-1");

    expect(result.tier).toBe("starter");
    expect(result.loadLimit).toBe(50);
    expect(result.carrierLimit).toBe(25);
  });
});
