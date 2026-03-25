import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lookupCarrier } from "@/lib/fmcsa/client";

describe("lookupCarrier", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.FMCSA_API_KEY;

  beforeEach(() => {
    process.env.FMCSA_API_KEY = "test-api-key";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.FMCSA_API_KEY = originalEnv;
  });

  it("returns error when FMCSA_API_KEY is not set", async () => {
    delete process.env.FMCSA_API_KEY;

    const result = await lookupCarrier("123456");

    expect(result.success).toBe(false);
    expect(result.error).toBe("FMCSA API key not configured");
    expect(result.data).toBeNull();
  });

  it("returns carrier data on successful lookup", async () => {
    const mockCarrier = {
      usdotNumber: "123456",
      legalName: "Test Trucking Inc",
      dbaName: null,
      entityType: "CARRIER",
      operatingStatus: "AUTHORIZED",
      mcNumber: "MC789",
      phyStreet: "123 Main St",
      phyCity: "Springfield",
      phyState: "IL",
      phyZipcode: "62701",
      phyCountry: "US",
      mailingStreet: "123 Main St",
      mailingCity: "Springfield",
      mailingState: "IL",
      mailingZipcode: "62701",
      mailingCountry: "US",
      telephone: "555-1234",
      fax: null,
      emailAddress: null,
      totalDrivers: 10,
      totalPowerUnits: 8,
      safetyRating: "Satisfactory",
      safetyRatingDate: null,
      ratingDate: null,
      crashTotal: 0,
      fatalCrash: 0,
      injCrash: 0,
      towCrash: 0,
      driverInsp: 0,
      driverOosInsp: 0,
      driverOosRate: 0,
      vehicleInsp: 0,
      vehicleOosInsp: 0,
      vehicleOosRate: 0,
      hazmatInsp: 0,
      hazmatOosInsp: 0,
      hazmatOosRate: 0,
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: { carrier: mockCarrier } }),
    });

    const result = await lookupCarrier("123456");

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockCarrier);
    expect(result.data?.legalName).toBe("Test Trucking Inc");
    expect(result.data?.operatingStatus).toBe("AUTHORIZED");
    expect(result.cachedAt).toBeInstanceOf(Date);
  });

  it("returns cached data when cachedData is within TTL", async () => {
    globalThis.fetch = vi.fn();

    const cachedSnapshot = { operatingStatus: "AUTHORIZED", legalName: "Cached Co" };
    const result = await lookupCarrier("123456", {
      fmcsaSnapshot: cachedSnapshot,
      fmcsaLastCheck: new Date(), // just now — within 7 day TTL
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(cachedSnapshot);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fetches fresh data when cachedData is expired", async () => {
    const mockCarrier = {
      usdotNumber: "123456",
      legalName: "Fresh Trucking",
      operatingStatus: "AUTHORIZED",
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: { carrier: mockCarrier } }),
    });

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const result = await lookupCarrier("123456", {
      fmcsaSnapshot: { operatingStatus: "OLD" },
      fmcsaLastCheck: eightDaysAgo,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockCarrier);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("fetches from API when no cachedData provided", async () => {
    const mockCarrier = {
      usdotNumber: "123456",
      legalName: "API Trucking",
      operatingStatus: "AUTHORIZED",
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: { carrier: mockCarrier } }),
    });

    const result = await lookupCarrier("123456");

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockCarrier);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns error when carrier is not found", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: { carrier: null } }),
    });

    const result = await lookupCarrier("999999");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Carrier not found in FMCSA database");
  });

  it("returns error on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await lookupCarrier("000000");

    expect(result.success).toBe(false);
    expect(result.error).toBe("FMCSA API returned status 404");
  });

  it("returns error on network failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));

    const result = await lookupCarrier("111111");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network timeout");
  });
});
