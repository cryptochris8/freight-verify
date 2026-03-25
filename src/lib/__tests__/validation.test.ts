import { describe, it, expect } from "vitest";
import {
  carrierCreateSchema,
  loadCreateSchema,
  otpVerifySchema,
  arrivalSchema,
  messageCreateSchema,
  checkoutSchema,
} from "@/lib/validation/schemas";
import { loadFormSchema, generateReferenceNumber } from "@/lib/loads/validation";

describe("carrierCreateSchema", () => {
  it("accepts valid carrier data", () => {
    const result = carrierCreateSchema.safeParse({
      dotNumber: "1234567",
      mcNumber: "789456",
      email: "test@carrier.com",
      phone: "(555) 123-4567",
      legalName: "Test Trucking",
    });
    expect(result.success).toBe(true);
  });

  it("requires dotNumber", () => {
    const result = carrierCreateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric DOT number", () => {
    const result = carrierCreateSchema.safeParse({ dotNumber: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects DOT number over 10 digits", () => {
    const result = carrierCreateSchema.safeParse({ dotNumber: "12345678901" });
    expect(result.success).toBe(false);
  });

  it("accepts empty optional fields", () => {
    const result = carrierCreateSchema.safeParse({
      dotNumber: "123",
      mcNumber: "",
      email: "",
      phone: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = carrierCreateSchema.safeParse({
      dotNumber: "123",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});

describe("loadCreateSchema", () => {
  const validLoad = {
    referenceNumber: "FV-20260301-123",
    originName: "Warehouse A",
    originAddress: "123 Main St",
    destinationName: "Center B",
    destinationAddress: "456 Oak Ave",
    pickupDate: "2026-03-15",
  };

  it("accepts valid load data", () => {
    expect(loadCreateSchema.safeParse(validLoad).success).toBe(true);
  });

  it("requires referenceNumber", () => {
    const { referenceNumber, ...rest } = validLoad;
    expect(loadCreateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects special characters in referenceNumber", () => {
    expect(
      loadCreateSchema.safeParse({ ...validLoad, referenceNumber: "FV 001!" }).success
    ).toBe(false);
  });

  it("rejects delivery date before pickup date", () => {
    const result = loadCreateSchema.safeParse({
      ...validLoad,
      pickupDate: "2026-03-20",
      deliveryDate: "2026-03-15",
    });
    expect(result.success).toBe(false);
  });

  it("accepts delivery date equal to pickup date", () => {
    const result = loadCreateSchema.safeParse({
      ...validLoad,
      pickupDate: "2026-03-15",
      deliveryDate: "2026-03-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative weight", () => {
    const result = loadCreateSchema.safeParse({ ...validLoad, weightLbs: "-100" });
    expect(result.success).toBe(false);
  });

  it("rejects negative rate", () => {
    const result = loadCreateSchema.safeParse({ ...validLoad, rateDollars: "-50" });
    expect(result.success).toBe(false);
  });
});

describe("otpVerifySchema", () => {
  it("accepts valid OTP", () => {
    const result = otpVerifySchema.safeParse({
      loadId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      otp: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-6-digit OTP", () => {
    expect(
      otpVerifySchema.safeParse({
        loadId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        otp: "12345",
      }).success
    ).toBe(false);
  });

  it("rejects non-numeric OTP", () => {
    expect(
      otpVerifySchema.safeParse({
        loadId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        otp: "abcdef",
      }).success
    ).toBe(false);
  });

  it("rejects invalid UUID for loadId", () => {
    expect(
      otpVerifySchema.safeParse({ loadId: "not-a-uuid", otp: "123456" }).success
    ).toBe(false);
  });
});

describe("arrivalSchema", () => {
  it("accepts valid coordinates", () => {
    const result = arrivalSchema.safeParse({
      loadId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      lat: 40.7128,
      lng: -74.006,
    });
    expect(result.success).toBe(true);
  });

  it("rejects lat out of range", () => {
    expect(
      arrivalSchema.safeParse({
        loadId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        lat: 91,
        lng: 0,
      }).success
    ).toBe(false);
  });

  it("rejects lng out of range", () => {
    expect(
      arrivalSchema.safeParse({
        loadId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        lat: 0,
        lng: 181,
      }).success
    ).toBe(false);
  });
});

describe("messageCreateSchema", () => {
  it("accepts valid message", () => {
    expect(messageCreateSchema.safeParse({ content: "Hello" }).success).toBe(true);
  });

  it("rejects empty message", () => {
    expect(messageCreateSchema.safeParse({ content: "" }).success).toBe(false);
  });

  it("rejects whitespace-only message", () => {
    expect(messageCreateSchema.safeParse({ content: "   " }).success).toBe(false);
  });

  it("rejects message over 5000 chars", () => {
    expect(
      messageCreateSchema.safeParse({ content: "a".repeat(5001) }).success
    ).toBe(false);
  });
});

describe("checkoutSchema", () => {
  it("accepts valid tiers", () => {
    expect(checkoutSchema.safeParse({ tier: "starter" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ tier: "professional" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ tier: "business" }).success).toBe(true);
  });

  it("rejects invalid tier", () => {
    expect(checkoutSchema.safeParse({ tier: "enterprise" }).success).toBe(false);
  });
});

describe("loadFormSchema", () => {
  it("accepts minimal valid form data", () => {
    const result = loadFormSchema.safeParse({
      referenceNumber: "FV-001",
      originName: "Origin",
      originAddress: "123 St",
      destinationName: "Dest",
      destinationAddress: "456 Ave",
      pickupDate: "2026-03-15",
    });
    expect(result.success).toBe(true);
  });
});

describe("generateReferenceNumber", () => {
  it("returns a string matching FV-YYYYMMDD-NNNNNN pattern", () => {
    const ref = generateReferenceNumber();
    expect(ref).toMatch(/^FV-\d{8}-\d{6}$/);
  });

  it("starts with FV-", () => {
    expect(generateReferenceNumber().startsWith("FV-")).toBe(true);
  });
});
