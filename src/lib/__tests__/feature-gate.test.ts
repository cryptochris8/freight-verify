import { describe, it, expect, vi, beforeEach } from "vitest";

// Track which queries are called
let queryResults: unknown[][] = [];
let queryIndex = 0;

// The feature-gate module has 3 query patterns:
// 1. getOrgTier: select().from(subscriptions).where().limit(1) → has .limit
// 2. getMonthlyLoadCount: select({value}).from(loads).where() → NO .limit, destructures [result]
// 3. getCarrierCount: select({value}).from(carriers).where() → NO .limit, destructures [result]
//
// We unify by making every terminal call resolve from queryResults

vi.mock("@/lib/db", () => {
  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const resolve = () => {
      const result = queryResults[queryIndex] ?? [];
      queryIndex++;
      return Promise.resolve(result);
    };
    // Each method returns the chain OR resolves if it's a terminal
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockImplementation(() => {
      // where() could be terminal (for count queries) or chained (for .limit)
      // Return a thenable proxy that also has .limit
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

import { checkAccess } from "@/lib/billing/feature-gate";

describe("checkAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
    queryResults = [];
  });

  describe("starter tier (no subscription)", () => {
    it("allows loadLimit when under 50", async () => {
      queryResults = [
        [],                   // getOrgTier → no subscription → starter
        [{ value: 10 }],     // getMonthlyLoadCount → 10
      ];
      const result = await checkAccess("org-1", "loadLimit");
      expect(result.allowed).toBe(true);
      expect(result.tier).toBe("starter");
      expect(result.currentUsage).toBe(10);
      expect(result.limit).toBe(50);
    });

    it("blocks loadLimit when at 50", async () => {
      queryResults = [
        [],                   // getOrgTier
        [{ value: 50 }],     // getMonthlyLoadCount
      ];
      const result = await checkAccess("org-1", "loadLimit");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("monthly limit of 50");
    });

    it("allows carrierLimit when under 25", async () => {
      queryResults = [
        [],                   // getOrgTier
        [{ value: 5 }],      // getCarrierCount
      ];
      const result = await checkAccess("org-1", "carrierLimit");
      expect(result.allowed).toBe(true);
      expect(result.tier).toBe("starter");
    });

    it("blocks carrierLimit when at 25", async () => {
      queryResults = [
        [],                   // getOrgTier
        [{ value: 25 }],     // getCarrierCount
      ];
      const result = await checkAccess("org-1", "carrierLimit");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("carrier limit of 25");
    });

    it("blocks smsAlerts on starter", async () => {
      queryResults = [[]];
      const result = await checkAccess("org-1", "smsAlerts");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Professional and Business");
    });

    it("blocks apiAccess on starter", async () => {
      queryResults = [[]];
      const result = await checkAccess("org-1", "apiAccess");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Professional and Business");
    });
  });

  describe("professional tier", () => {
    it("allows smsAlerts on professional", async () => {
      queryResults = [
        [{ planTier: "professional", status: "active" }],
      ];
      const result = await checkAccess("org-1", "smsAlerts");
      expect(result.allowed).toBe(true);
      expect(result.tier).toBe("professional");
    });

    it("allows apiAccess on professional", async () => {
      queryResults = [
        [{ planTier: "professional", status: "active" }],
      ];
      const result = await checkAccess("org-1", "apiAccess");
      expect(result.allowed).toBe(true);
    });

    it("allows unlimited carriers on professional", async () => {
      queryResults = [
        [{ planTier: "professional", status: "active" }],
        [{ value: 100 }],
      ];
      const result = await checkAccess("org-1", "carrierLimit");
      expect(result.allowed).toBe(true);
    });
  });

  describe("canceled subscription falls back to starter", () => {
    it("returns starter features when canceled", async () => {
      queryResults = [
        [{ planTier: "professional", status: "canceled" }],
      ];
      const result = await checkAccess("org-1", "smsAlerts");
      expect(result.allowed).toBe(false);
      expect(result.tier).toBe("starter");
    });

    it("returns starter features when unpaid", async () => {
      queryResults = [
        [{ planTier: "business", status: "unpaid" }],
      ];
      const result = await checkAccess("org-1", "apiAccess");
      expect(result.allowed).toBe(false);
      expect(result.tier).toBe("starter");
    });
  });
});
