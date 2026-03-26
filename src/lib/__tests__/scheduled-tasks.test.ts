import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── DB mock ─────────────────────────────────────────────────────────────────
// dailyFmcsaRecheck issues:
//   1. db.select().from().where()          → activeCarriers
//
// dailyDocExpirationCheck issues:
//   1. db.select().from().where()          → expiringDocs
//   2. db.select().from().where()          → existingAlerts
//
// Both functions also call db.update().set().where() and db.insert().values().
// We use a call-counter approach so queued selectResults are consumed in order.

let selectCallCount = 0;
let selectResults: unknown[][] = [];

const mockDbUpdate = vi.fn();
const mockDbInsertValues = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(selectResults[selectCallCount++] ?? []),
      }),
    }),
    update: () => ({
      set: () => ({
        where: mockDbUpdate,
      }),
    }),
    insert: () => ({
      values: mockDbInsertValues,
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  carriers: {},
  carrierDocuments: {},
  alerts: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  lte: vi.fn((...args: unknown[]) => args),
  gte: vi.fn((...args: unknown[]) => args),
  inArray: vi.fn((...args: unknown[]) => args),
}));

vi.mock("@/lib/fmcsa/client", () => ({
  lookupCarrier: vi.fn(),
}));

vi.mock("@/lib/alerts/rules", () => ({
  checkFmcsaStatusChange: vi.fn().mockReturnValue({ triggered: false }),
}));

vi.mock("@/lib/notifications/daily-digest", () => ({
  sendDailyDigest: vi.fn().mockResolvedValue({ success: true, emailId: "email-1" }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// date-fns addDays is used for the 30-day window; let it pass through as real.
vi.mock("date-fns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("date-fns")>();
  return { ...actual };
});

// ─── Import after mocks ───────────────────────────────────────────────────────
import { dailyFmcsaRecheck, dailyDocExpirationCheck } from "@/lib/cron/scheduled-tasks";
import { lookupCarrier } from "@/lib/fmcsa/client";
import { checkFmcsaStatusChange } from "@/lib/alerts/rules";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ORG_ID = "org-test-1";

const makeCarrier = (overrides: Record<string, unknown> = {}) => ({
  id: "carrier-1",
  dotNumber: "1234567",
  legalName: "Test Carrier LLC",
  fmcsaSnapshot: { operatingStatus: "AUTHORIZED FOR PROPERTY" },
  fmcsaLastCheck: new Date("2024-01-01"),
  ...overrides,
});

const makeFmcsaResult = (operatingStatus = "AUTHORIZED FOR PROPERTY") => ({
  success: true as const,
  data: {
    operatingStatus,
    dotNumber: "1234567",
    legalName: "Test Carrier LLC",
  },
});

const makeDoc = (daysFromNow: number, overrides: Record<string, unknown> = {}) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysFromNow);
  return {
    id: `doc-${daysFromNow}`,
    carrierId: "carrier-1",
    docType: "insurance_cert",
    expiresAt,
    ...overrides,
  };
};

// ─── dailyFmcsaRecheck ────────────────────────────────────────────────────────

describe("dailyFmcsaRecheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectResults = [];
    mockDbUpdate.mockResolvedValue(undefined);
    mockDbInsertValues.mockResolvedValue(undefined);
  });

  it("skips processing when there are no active carriers", async () => {
    selectResults = [[]]; // carriers query → empty

    await dailyFmcsaRecheck(ORG_ID);

    expect(lookupCarrier).not.toHaveBeenCalled();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it("updates the carrier FMCSA snapshot on a successful lookup", async () => {
    const carrier = makeCarrier();
    selectResults = [[carrier]];

    vi.mocked(lookupCarrier).mockResolvedValueOnce(makeFmcsaResult());

    await dailyFmcsaRecheck(ORG_ID);

    expect(lookupCarrier).toHaveBeenCalledOnce();
    expect(lookupCarrier).toHaveBeenCalledWith("1234567");
    expect(mockDbUpdate).toHaveBeenCalledOnce();
  });

  it("creates an alert when the FMCSA operating status changes", async () => {
    const carrier = makeCarrier({
      fmcsaSnapshot: { operatingStatus: "AUTHORIZED FOR PROPERTY" },
    });
    selectResults = [[carrier]];

    // New status differs from previous snapshot
    vi.mocked(lookupCarrier).mockResolvedValueOnce(
      makeFmcsaResult("NOT AUTHORIZED")
    );

    vi.mocked(checkFmcsaStatusChange).mockReturnValueOnce({
      triggered: true,
      alertType: "fmcsa_status_change",
      severity: "high",
      title: "FMCSA Status Changed",
      message: "Status changed from AUTHORIZED FOR PROPERTY to NOT AUTHORIZED",
      metadata: { previousStatus: "AUTHORIZED FOR PROPERTY", currentStatus: "NOT AUTHORIZED" },
    });

    await dailyFmcsaRecheck(ORG_ID);

    expect(checkFmcsaStatusChange).toHaveBeenCalledOnce();
    expect(checkFmcsaStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        carrierId: "carrier-1",
        previousStatus: "AUTHORIZED FOR PROPERTY",
        currentStatus: "NOT AUTHORIZED",
      })
    );
    expect(mockDbInsertValues).toHaveBeenCalledOnce();
  });

  it("continues processing remaining carriers when one lookup fails", async () => {
    const carrier1 = makeCarrier({ id: "carrier-1", dotNumber: "1111111" });
    const carrier2 = makeCarrier({ id: "carrier-2", dotNumber: "2222222" });
    selectResults = [[carrier1, carrier2]];

    vi.mocked(lookupCarrier)
      .mockRejectedValueOnce(new Error("FMCSA API timeout"))
      .mockResolvedValueOnce(makeFmcsaResult());

    await dailyFmcsaRecheck(ORG_ID);

    // Both carriers attempted despite the first throwing
    expect(lookupCarrier).toHaveBeenCalledTimes(2);
    // The second carrier should still update the DB
    expect(mockDbUpdate).toHaveBeenCalledOnce();
  });
});

// ─── dailyDocExpirationCheck ──────────────────────────────────────────────────

describe("dailyDocExpirationCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectResults = [];
    mockDbUpdate.mockResolvedValue(undefined);
    mockDbInsertValues.mockResolvedValue(undefined);
  });

  it("skips alert creation when there are no expiring documents", async () => {
    selectResults = [[]]; // expiringDocs → empty

    await dailyDocExpirationCheck(ORG_ID);

    // Should not have made the second select (existingAlerts) or any insert
    expect(mockDbInsertValues).not.toHaveBeenCalled();
  });

  it("creates an alert for an expiring document", async () => {
    const doc = makeDoc(20); // 20 days away → medium severity
    selectResults = [
      [doc],  // expiringDocs
      [],     // existingAlerts → none open for this carrier
    ];

    await dailyDocExpirationCheck(ORG_ID);

    expect(mockDbInsertValues).toHaveBeenCalledOnce();
    const insertArg = mockDbInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.alertType).toBe("document_expiration");
    expect(insertArg.severity).toBe("medium");
    expect(insertArg.carrierId).toBe("carrier-1");
    expect(insertArg.orgId).toBe(ORG_ID);
  });

  it("skips documents whose carrier already has an open document_expiration alert", async () => {
    const doc1 = makeDoc(20, { id: "doc-a", carrierId: "carrier-1" });
    const doc2 = makeDoc(25, { id: "doc-b", carrierId: "carrier-1" });
    selectResults = [
      [doc1, doc2],                       // expiringDocs — two docs, same carrier
      [{ carrierId: "carrier-1" }],       // existingAlerts — carrier-1 already has alert
    ];

    await dailyDocExpirationCheck(ORG_ID);

    // Neither doc should trigger a new insert because the carrier already has an open alert
    expect(mockDbInsertValues).not.toHaveBeenCalled();
  });

  it("sets severity to critical when document expires within 7 days", async () => {
    const doc = makeDoc(5); // 5 days → critical
    selectResults = [
      [doc],
      [],
    ];

    await dailyDocExpirationCheck(ORG_ID);

    expect(mockDbInsertValues).toHaveBeenCalledOnce();
    const insertArg = mockDbInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.severity).toBe("critical");
  });

  it("sets severity to high when document expires within 8–14 days", async () => {
    const doc = makeDoc(10); // 10 days → high
    selectResults = [
      [doc],
      [],
    ];

    await dailyDocExpirationCheck(ORG_ID);

    expect(mockDbInsertValues).toHaveBeenCalledOnce();
    const insertArg = mockDbInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.severity).toBe("high");
  });

  it("sets severity to medium when document expires in 15–30 days", async () => {
    const doc = makeDoc(25); // 25 days → medium
    selectResults = [
      [doc],
      [],
    ];

    await dailyDocExpirationCheck(ORG_ID);

    expect(mockDbInsertValues).toHaveBeenCalledOnce();
    const insertArg = mockDbInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.severity).toBe("medium");
  });
});
