import { describe, it, expect } from "vitest";
import { runAlertRules, type AlertEngineContext } from "@/lib/alerts/engine";

describe("runAlertRules", () => {
  it("returns empty array when no context fields are provided", () => {
    const results = runAlertRules({});
    expect(results).toEqual([]);
  });

  it("fires carrier_substitution rule when context has the required fields", () => {
    const results = runAlertRules({
      loadId: "load-1",
      loadStatus: "accepted",
      previousCarrierId: "carrier-a",
      currentCarrierId: "carrier-b",
    });
    expect(results).toHaveLength(1);
    expect(results[0].alertType).toBe("carrier_substitution");
    expect(results[0].triggered).toBe(true);
  });

  it("skips carrier_substitution when loadStatus is missing", () => {
    const results = runAlertRules({
      loadId: "load-1",
      previousCarrierId: "carrier-a",
      currentCarrierId: "carrier-b",
    });
    expect(results).toEqual([]);
  });

  it("fires domain_mismatch rule when emails differ", () => {
    const results = runAlertRules({
      carrierId: "c-1",
      carrierEmail: "dispatch@fakecarrier.com",
      fmcsaEmail: "contact@realcarrier.com",
    });
    expect(results).toHaveLength(1);
    expect(results[0].alertType).toBe("domain_mismatch");
  });

  it("does not fire domain_mismatch when emails share domain", () => {
    const results = runAlertRules({
      carrierId: "c-1",
      carrierEmail: "dispatch@carrier.com",
      fmcsaEmail: "contact@carrier.com",
    });
    expect(results).toEqual([]);
  });

  it("fires off_location_pickup rule when distance exceeds 5 miles", () => {
    const results = runAlertRules({
      loadId: "load-1",
      verificationLat: 40.7128,
      verificationLng: -74.006,
      originLat: 34.0522,
      originLng: -118.2437,
    });
    expect(results).toHaveLength(1);
    expect(results[0].alertType).toBe("off_location_pickup");
  });

  it("does not fire off_location_pickup when within range", () => {
    const results = runAlertRules({
      loadId: "load-1",
      verificationLat: 40.758,
      verificationLng: -73.9855,
      originLat: 40.7527,
      originLng: -73.9772,
    });
    expect(results).toEqual([]);
  });

  it("fires failed_verification rule when attempts >= 3", () => {
    const results = runAlertRules({
      loadId: "load-1",
      otpAttempts: 3,
    });
    expect(results).toHaveLength(1);
    expect(results[0].alertType).toBe("failed_verification");
  });

  it("does not fire failed_verification when attempts < 3", () => {
    const results = runAlertRules({
      loadId: "load-1",
      otpAttempts: 2,
    });
    expect(results).toEqual([]);
  });

  it("fires document_expiration rule for document expiring within 30 days", () => {
    const results = runAlertRules({
      carrierId: "c-1",
      documentId: "doc-1",
      documentType: "insurance_cert",
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
    });
    expect(results).toHaveLength(1);
    expect(results[0].alertType).toBe("document_expiration");
  });

  it("fires fmcsa_status_change rule when status changes", () => {
    const results = runAlertRules({
      carrierId: "c-1",
      dotNumber: "123456",
      previousFmcsaStatus: "AUTHORIZED",
      currentFmcsaStatus: "NOT_AUTHORIZED",
    });
    expect(results).toHaveLength(1);
    expect(results[0].alertType).toBe("fmcsa_status_change");
    expect(results[0].severity).toBe("critical");
  });

  it("returns multiple triggered alerts when context matches multiple rules", () => {
    const results = runAlertRules({
      loadId: "load-1",
      loadStatus: "accepted",
      previousCarrierId: "carrier-a",
      currentCarrierId: "carrier-b",
      otpAttempts: 5,
      verificationLat: 40.7128,
      verificationLng: -74.006,
      originLat: 34.0522,
      originLng: -118.2437,
    });
    // carrier_substitution + failed_verification + off_location_pickup
    expect(results.length).toBe(3);
    const types = results.map((r) => r.alertType);
    expect(types).toContain("carrier_substitution");
    expect(types).toContain("failed_verification");
    expect(types).toContain("off_location_pickup");
  });

  it("skips rules when partial context fields are missing", () => {
    // Has carrierId but missing fmcsaEmail — domain_mismatch should NOT fire
    // Has loadId but missing verificationLat — off_location should NOT fire
    const results = runAlertRules({
      loadId: "load-1",
      carrierId: "c-1",
      carrierEmail: "test@example.com",
      // fmcsaEmail intentionally omitted
      // verificationLat intentionally omitted
    });
    expect(results).toEqual([]);
  });
});
