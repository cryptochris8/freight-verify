import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockSelect,
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: mockInsert,
      }),
    }),
    update: () => ({
      set: () => ({
        where: mockUpdate,
      }),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  loads: {},
  carriers: {},
  pickupVerifications: {},
}));

vi.mock("@/lib/events/create-event", () => ({
  createChainedEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the otp module to return deterministic values
vi.mock("@/lib/verification/otp", () => ({
  generateOtp: vi.fn().mockReturnValue("123456"),
  hashOtp: vi.fn().mockReturnValue("salt:hash"),
}));

import { generatePickupVerification, sendPickupOtp } from "@/lib/verification/pickup-service";

describe("generatePickupVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when load is not found", async () => {
    mockSelect.mockResolvedValueOnce([]);

    const result = await generatePickupVerification("nonexistent-id");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Load not found");
  });

  it("returns error when load is not in accepted status", async () => {
    mockSelect.mockResolvedValueOnce([{ id: "load-1", status: "draft", orgId: "org-1" }]);

    const result = await generatePickupVerification("load-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Load must be in 'accepted' status");
  });

  it("generates verification for accepted load without carrier", async () => {
    mockSelect.mockResolvedValueOnce([
      {
        id: "load-1",
        status: "accepted",
        orgId: "org-1",
        carrierId: null,
        metadata: null,
        referenceNumber: "REF-001",
      },
    ]);

    mockInsert.mockResolvedValueOnce([{ id: "verification-1" }]);

    const result = await generatePickupVerification("load-1");

    expect(result.success).toBe(true);
    expect(result.otp).toBe("123456");
    expect(result.verificationId).toBe("verification-1");
  });

  it("generates verification for accepted load with carrier", async () => {
    // Load query
    mockSelect.mockResolvedValueOnce([
      {
        id: "load-1",
        status: "accepted",
        orgId: "org-1",
        carrierId: "carrier-1",
        metadata: { driverName: "John", driverPhone: "555-0100" },
        referenceNumber: "REF-002",
      },
    ]);

    // Carrier query
    mockSelect.mockResolvedValueOnce([
      { id: "carrier-1", phone: "555-0200" },
    ]);

    mockInsert.mockResolvedValueOnce([{ id: "verification-2" }]);

    const result = await generatePickupVerification("load-1");

    expect(result.success).toBe(true);
    expect(result.otp).toBe("123456");
    expect(result.verificationId).toBe("verification-2");
  });
});

describe("sendPickupOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  it("returns error when verification record is not found", async () => {
    mockSelect.mockResolvedValueOnce([]);

    const result = await sendPickupOtp("nonexistent", "555-0100", "123456");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Verification record not found");
  });

  it("logs fallback when Twilio is not configured", async () => {
    // Verification query
    mockSelect.mockResolvedValueOnce([{ id: "v-1", loadId: "load-1" }]);
    // Load query
    mockSelect.mockResolvedValueOnce([{ id: "load-1", orgId: "org-1", referenceNumber: "REF-001", originName: "Origin" }]);
    mockUpdate.mockResolvedValue(undefined);

    const result = await sendPickupOtp("v-1", "555-0100", "123456");

    expect(result.success).toBe(true);
  });
});
