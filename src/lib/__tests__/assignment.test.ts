import { describe, it, expect, vi, beforeEach } from "vitest";

// -------------------------------------------------------------------
// Shared mock state — must be declared before vi.mock() hoisting
// -------------------------------------------------------------------
const mockUpdate = vi.fn();

// selectResults queue — each db.select() call consumes the next entry.
// Mutable array so beforeEach can swap its contents without rebinding.
const selectResults: unknown[][] = [];
let selectCallCount = 0;

/**
 * Build a select chain whose `.where()` result is both awaitable AND
 * has a `.limit()` method — covering both query shapes in assignment.ts:
 *   - carriers/loads: .select().from().where().limit(1)
 *   - alerts:         .select().from().where()          (no limit)
 */
function makeSelectChain() {
  const value = selectResults[selectCallCount] ?? [];
  selectCallCount++;

  // Create a "thenable" object that also exposes .limit()
  const thenable = Object.assign(Promise.resolve(value), {
    limit: () => Promise.resolve(value),
  });

  return {
    from: () => ({
      where: () => thenable,
    }),
  };
}

// -------------------------------------------------------------------
// Module mocks
// -------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    select: () => makeSelectChain(),
    update: () => ({
      set: () => ({
        where: mockUpdate,
      }),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  carriers: {},
  loads: {},
  alerts: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock("@/lib/events/create-event", () => ({
  createChainedEvent: vi.fn().mockResolvedValue({}),
}));

// -------------------------------------------------------------------
// Import module under test AFTER mocks are registered
// -------------------------------------------------------------------
import { validateAssignment, assignCarrier, unassignCarrier } from "@/lib/loads/assignment";
import { createChainedEvent } from "@/lib/events/create-event";

// -------------------------------------------------------------------
// Helper to set the queue for the next test
// -------------------------------------------------------------------
function setSelectResults(...rows: unknown[][]) {
  selectResults.length = 0;
  selectResults.push(...rows);
  selectCallCount = 0;
}

// ===================================================================
// validateAssignment
// ===================================================================

describe("validateAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSelectResults();
    mockUpdate.mockResolvedValue(undefined);
  });

  it("returns invalid when carrier is not found", async () => {
    setSelectResults([]);

    const result = await validateAssignment("carrier-missing");

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Carrier not found");
    expect(result.carrier).toBeUndefined();
  });

  it("returns invalid with status error when carrier is not verified", async () => {
    setSelectResults(
      [{ id: "c-1", status: "pending", insuranceOnFile: true }],
      [] // alerts — no critical alerts
    );

    const result = await validateAssignment("c-1");

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("pending"))).toBe(true);
    expect(result.errors.some((e) => e.includes("verified"))).toBe(true);
  });

  it("returns invalid with alert count when carrier has critical open alerts", async () => {
    setSelectResults(
      [{ id: "c-1", status: "verified", insuranceOnFile: true }],
      [{ id: "a-1" }, { id: "a-2" }] // two critical open alerts
    );

    const result = await validateAssignment("c-1");

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("2"))).toBe(true);
    expect(result.errors.some((e) => e.toLowerCase().includes("critical"))).toBe(true);
  });

  it("returns valid for a verified carrier with no critical alerts", async () => {
    setSelectResults(
      [{ id: "c-1", status: "verified", insuranceOnFile: true }],
      [] // no critical alerts
    );

    const result = await validateAssignment("c-1");

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.carrier).toMatchObject({ id: "c-1", status: "verified" });
  });

  it("returns valid with a warning when carrier has no insurance on file", async () => {
    setSelectResults(
      [{ id: "c-1", status: "verified", insuranceOnFile: false }],
      []
    );

    const result = await validateAssignment("c-1");

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some((w) => w.toLowerCase().includes("insurance"))).toBe(true);
  });
});

// ===================================================================
// assignCarrier
// ===================================================================

describe("assignCarrier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSelectResults();
    mockUpdate.mockResolvedValue(undefined);
  });

  it("returns error when carrier validation fails", async () => {
    setSelectResults([]); // carrier not found

    const result = await assignCarrier("load-1", "carrier-bad", "user-1", "org-1");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Carrier not found");
  });

  it("returns success, updates load, and creates event when carrier is valid", async () => {
    setSelectResults(
      [{ id: "c-1", status: "verified", insuranceOnFile: true, legalName: "Acme Freight LLC" }],
      [] // no critical alerts
    );

    const result = await assignCarrier("load-1", "c-1", "user-1", "org-1");

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(createChainedEvent).toHaveBeenCalledTimes(1);
    expect(createChainedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        loadId: "load-1",
        orgId: "org-1",
        eventType: "carrier_assigned",
        actorId: "user-1",
        actorType: "user",
      })
    );
  });

  it("passes actorType 'system' when actorId is null", async () => {
    setSelectResults(
      [{ id: "c-1", status: "verified", insuranceOnFile: true, legalName: "Acme Freight LLC" }],
      []
    );

    await assignCarrier("load-1", "c-1", null, "org-1");

    expect(createChainedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        actorType: "system",
      })
    );
  });
});

// ===================================================================
// unassignCarrier
// ===================================================================

describe("unassignCarrier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSelectResults();
    mockUpdate.mockResolvedValue(undefined);
  });

  it("returns error when load is not found", async () => {
    setSelectResults([]);

    const result = await unassignCarrier("load-missing", "user-1", "org-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Load not found");
  });

  it("returns error when load has no carrier assigned", async () => {
    setSelectResults([{ id: "load-1", carrierId: null }]);

    const result = await unassignCarrier("load-1", "user-1", "org-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("No carrier assigned");
  });

  it("clears carrierId, updates load, and creates event on success", async () => {
    setSelectResults([{ id: "load-1", carrierId: "c-1" }]);

    const result = await unassignCarrier("load-1", "user-1", "org-1");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(createChainedEvent).toHaveBeenCalledTimes(1);
    expect(createChainedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        loadId: "load-1",
        orgId: "org-1",
        eventType: "carrier_unassigned",
        actorId: "user-1",
        actorType: "user",
        metadata: expect.objectContaining({ previousCarrierId: "c-1" }),
      })
    );
  });

  it("passes actorType 'system' when actorId is null", async () => {
    setSelectResults([{ id: "load-1", carrierId: "c-1" }]);

    await unassignCarrier("load-1", null, "org-1");

    expect(createChainedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        actorType: "system",
      })
    );
  });
});
