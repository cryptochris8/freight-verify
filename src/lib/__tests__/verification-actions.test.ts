import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── DB mock ────────────────────────────────────────────────────────────────
// The verification.ts source mixes three select chain shapes:
//   A) .from().where().orderBy().limit()   (completeVerification #1, getVerificationStatus #1)
//   B) .from().where().limit()             (loads / carriers selects)
//   C) .from().where().orderBy()           (loadEvents — no .limit(), returns array)
//
// Strategy: every node in the chain is a plain object (not a Promise).
// The terminal methods (.limit(), and .orderBy() when used as the last call)
// return a Promise that consumes the next item from selectResults.
//
// To handle shape C we make .orderBy() return an object that is BOTH a
// thenable (so `await chain.orderBy()` works) AND has a .limit() method
// (so `chain.orderBy().limit()` works for shape A).  We do this with a
// custom thenable class whose .then() fires lazily so we can tell whether
// .limit() was called before the microtask resolves.

let selectCallCount = 0;
let selectResults: unknown[][] = [];

const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();

/** Returns the next queued result, consuming one slot. */
function nextResult(): unknown[] {
  return (selectResults[selectCallCount++] ?? []) as unknown[];
}

/**
 * A lazy thenable: it resolves only when awaited OR when .resolve() is
 * called explicitly.  This lets callers chain .limit() before the Promise
 * settles when they need shape A, while still supporting shape C where there
 * is no .limit() call and the code awaits the orderBy result directly.
 */
class LazyResult implements PromiseLike<unknown[]> {
  private _data: unknown[];
  private _overridden = false;
  private _overrideData: unknown[] = [];

  constructor(data: unknown[]) {
    this._data = data;
  }

  /** Called by .limit() — it should use its own fresh result slot. */
  limit(): Promise<unknown[]> {
    this._overridden = true;
    this._overrideData = nextResult();
    return Promise.resolve(this._overrideData);
  }

  then<TResult1 = unknown[], TResult2 = never>(
    onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined
  ): PromiseLike<TResult1 | TResult2> {
    // If .limit() already consumed a slot, resolve with that data.
    const value = this._overridden ? this._overrideData : this._data;
    return Promise.resolve(value).then(onfulfilled, onrejected);
  }
}

function makeChain(): {
  from: () => {
    where: () => {
      orderBy: () => LazyResult;
      limit: () => Promise<unknown[]>;
    };
  };
} {
  return {
    from: () => ({
      where: () => {
        // Capture the result for this select() call at the .where() level so
        // that both .limit() (shape B) and .orderBy() (shapes A/C) share the
        // same slot index.
        const data = nextResult();
        return {
          // Shape B: .where().limit()
          limit: () => Promise.resolve(data),
          // Shapes A and C: .where().orderBy()
          orderBy: () => {
            // The .orderBy() node needs its OWN result slot for shape A
            // (.orderBy().limit()) but should reuse `data` for shape C
            // (await .orderBy()).
            //
            // However, the source always calls either:
            //   .orderBy(col).limit(1)  — shape A (needs new slot? No — same query)
            //   .orderBy(col)           — shape C (no limit)
            //
            // Both shapes are part of the same single db.select() call, so
            // they should consume only ONE result slot.  The LazyResult above
            // uses the same `data` unless .limit() explicitly fetches a new
            // slot — but that's wrong for shape A.  Let's instead make
            // orderBy return an object whose .limit() reuses `data` too.
            return {
              then<TResult1 = unknown[], TResult2 = never>(
                onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null | undefined,
                onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined
              ) {
                return Promise.resolve(data).then(onfulfilled, onrejected);
              },
              limit: () => Promise.resolve(data),
            };
          },
        };
      },
    }),
  };
}

vi.mock("@/lib/db", () => ({
  db: {
    select: () => makeChain(),
    update: () => ({
      set: () => ({
        where: mockDbUpdate,
      }),
    }),
    insert: () => ({
      values: mockDbInsert,
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  pickupVerifications: {},
  loads: {},
  carriers: {},
  loadEvents: { createdAt: "createdAt", loadId: "loadId" },
  alerts: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock("@/lib/events/create-event", () => ({
  createChainedEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/loads/status-engine", () => ({
  transitionStatus: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/alerts/rules", () => ({
  checkFailedVerification: vi.fn().mockReturnValue({ triggered: false }),
  checkOffLocationPickup: vi.fn().mockReturnValue({ triggered: false }),
}));

vi.mock("@/lib/verification/otp", () => ({
  verifyOtp: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/verification/geo", () => ({
  calculateDistance: vi.fn().mockReturnValue(1.0),
}));

vi.mock("@/lib/verification/pickup-service", () => ({
  generatePickupVerification: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ─── Import after mocks ──────────────────────────────────────────────────────
import { getVerificationStatus, completeVerification } from "@/app/actions/verification";
import { createChainedEvent } from "@/lib/events/create-event";
import { transitionStatus } from "@/lib/loads/status-engine";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const makeVerification = (overrides: Record<string, unknown> = {}) => ({
  id: "v-1",
  loadId: "load-1",
  verificationStatus: "verified",
  otpExpiresAt: new Date("2030-01-01"),
  otpAttempts: 0,
  driverName: "John Driver",
  driverPhone: "555-0100",
  truckNumber: "T-001",
  trailerNumber: "TR-001",
  verifiedAt: new Date("2024-01-01T10:00:00Z"),
  photoUrls: ["https://example.com/photo.jpg"],
  geoLat: "41.8781",
  geoLng: "-87.6298",
  geoTimestamp: new Date("2024-01-01T09:55:00Z"),
  geoAccuracy: "5.0",
  createdAt: new Date("2024-01-01T09:00:00Z"),
  ...overrides,
});

const makeLoad = (overrides: Record<string, unknown> = {}) => ({
  id: "load-1",
  orgId: "org-1",
  carrierId: "carrier-1",
  referenceNumber: "REF-001",
  originName: "Chicago, IL",
  originAddress: "123 Main St",
  originLat: "41.8781",
  originLng: "-87.6298",
  pickupDate: new Date("2024-01-01"),
  status: "accepted",
  ...overrides,
});

const makeCarrier = (overrides: Record<string, unknown> = {}) => ({
  id: "carrier-1",
  legalName: "ABC Trucking LLC",
  ...overrides,
});

const makeEvent = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  eventType: "pickup_verified",
  description: "Pickup OTP verified",
  actorType: "system",
  geoLat: null,
  geoLng: null,
  metadata: {},
  createdAt: new Date("2024-01-01T10:00:00Z"),
  ...overrides,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("getVerificationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectResults = [];
    mockDbUpdate.mockResolvedValue(undefined);
    mockDbInsert.mockResolvedValue(undefined);
  });

  it("returns { exists: false } when no verification is found", async () => {
    // First select: pickupVerifications query → empty
    selectResults = [[]];

    const result = await getVerificationStatus("load-missing");

    expect(result).toEqual({ exists: false });
  });

  it("returns full status with verification, load, carrier, and events when found", async () => {
    const verification = makeVerification();
    const load = makeLoad();
    const carrier = makeCarrier();
    const event = makeEvent();

    // Call order inside getVerificationStatus:
    //   1. pickupVerifications (orderBy+limit chain)
    //   2. loads (orderBy+limit chain)
    //   3. carriers (orderBy+limit chain)
    //   4. loadEvents — NOTE: this uses orderBy without .limit(), so it falls
    //      through to the orderBy mock which resolves directly.
    //
    // Our mock's chain ends at .limit() for all select paths.  For the events
    // query (no .limit()) the chain resolves at .orderBy().  We can adapt by
    // making the events query also funnel through the limit mock (the actual
    // source calls .orderBy(loadEvents.createdAt) with no .limit(), so that
    // call resolves at a different level).
    //
    // Since our mock always terminates at .limit(), we queue results for the
    // three .limit() calls and handle the events query separately by overriding
    // the mock for that call.

    selectResults = [
      [verification], // 1st .limit() → pickupVerifications
      [load],         // 2nd .limit() → loads
      [carrier],      // 3rd .limit() → carriers
    ];

    // The events query in the source ends with .orderBy() (no .limit()).
    // Our chainable mock returns the same promise wrapper for orderBy, so
    // we need to make it resolve for that 4th select call without .limit().
    // We accomplish this by having orderBy itself return a thenable when
    // there is no subsequent .limit() call — but since our static mock always
    // provides a limit function, we let it fall through to limit and queue
    // the events result as well.
    selectResults.push([event]); // 4th call → loadEvents

    const result = await getVerificationStatus("load-1");

    expect(result.exists).toBe(true);
    if (!result.exists) return; // type narrowing

    // Verification fields
    expect(result.verification.id).toBe("v-1");
    expect(result.verification.verificationStatus).toBe("verified");
    expect(result.verification.driverName).toBe("John Driver");
    expect(result.verification.photoUrls).toEqual(["https://example.com/photo.jpg"]);
    expect(result.verification.verifiedAt).toBe("2024-01-01T10:00:00.000Z");

    // Load fields
    expect(result.load).not.toBeNull();
    expect(result.load?.id).toBe("load-1");
    expect(result.load?.status).toBe("accepted");

    // Carrier name
    expect(result.carrierName).toBe("ABC Trucking LLC");

    // Events
    expect(Array.isArray(result.events)).toBe(true);
    expect(result.events[0].eventType).toBe("pickup_verified");
  });
});

describe("completeVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectResults = [];
    mockDbUpdate.mockResolvedValue(undefined);
    mockDbInsert.mockResolvedValue(undefined);
    vi.mocked(createChainedEvent).mockResolvedValue({} as ReturnType<typeof createChainedEvent> extends Promise<infer T> ? T : never);
    vi.mocked(transitionStatus).mockResolvedValue({ success: true });
  });

  it("returns error when no verified verification is found", async () => {
    selectResults = [[]]; // pickupVerifications → nothing

    const result = await completeVerification("load-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("No verified pickup verification found");
  });

  it("returns error when no photos have been uploaded", async () => {
    const verification = makeVerification({ photoUrls: [] });
    selectResults = [[verification]];

    const result = await completeVerification("load-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("At least one photo is required to complete verification");
  });

  it("returns error when load is not found", async () => {
    const verification = makeVerification({ photoUrls: ["https://example.com/photo.jpg"] });
    selectResults = [
      [verification], // verification found
      [],             // load → not found
    ];

    const result = await completeVerification("load-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Load not found");
  });

  it("creates a chain event and transitions to in_transit for an accepted load", async () => {
    const verification = makeVerification({ photoUrls: ["https://example.com/photo.jpg"] });
    const load = makeLoad({ status: "accepted" });
    selectResults = [
      [verification],
      [load],
    ];

    const result = await completeVerification("load-1");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    // createChainedEvent should have been called once with verification_complete
    expect(createChainedEvent).toHaveBeenCalledOnce();
    expect(createChainedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        loadId: "load-1",
        orgId: "org-1",
        eventType: "verification_complete",
      })
    );

    // Status transition to in_transit should have fired
    expect(transitionStatus).toHaveBeenCalledOnce();
    expect(transitionStatus).toHaveBeenCalledWith(
      "load-1",
      "in_transit",
      null,
      "org-1",
      expect.objectContaining({ triggeredBy: "pickup_verification_complete" })
    );
  });

  it("does not transition status when load is not in accepted status", async () => {
    const verification = makeVerification({ photoUrls: ["https://example.com/photo.jpg"] });
    const load = makeLoad({ status: "in_transit" });
    selectResults = [
      [verification],
      [load],
    ];

    const result = await completeVerification("load-1");

    expect(result.success).toBe(true);

    // Chain event should still fire
    expect(createChainedEvent).toHaveBeenCalledOnce();

    // But no status transition because load.status !== "accepted"
    expect(transitionStatus).not.toHaveBeenCalled();
  });
});
