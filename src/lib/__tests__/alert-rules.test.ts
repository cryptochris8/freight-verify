import { describe, it, expect } from "vitest";
import {
  checkCarrierSubstitution,
  checkDomainMismatch,
  checkOffLocationPickup,
  checkFailedVerification,
  checkDocumentExpiration,
  checkFmcsaStatusChange,
} from "@/lib/alerts/rules";

describe("checkCarrierSubstitution", () => {
  it("triggers when carrier changed on accepted load", () => {
    const result = checkCarrierSubstitution({
      loadId: "load-1",
      previousCarrierId: "carrier-a",
      currentCarrierId: "carrier-b",
      loadStatus: "accepted",
    });
    expect(result.triggered).toBe(true);
    expect(result.alertType).toBe("carrier_substitution");
    expect(result.severity).toBe("critical");
  });

  it("triggers when carrier changed on in_transit load", () => {
    const result = checkCarrierSubstitution({
      loadId: "load-1",
      previousCarrierId: "carrier-a",
      currentCarrierId: "carrier-b",
      loadStatus: "in_transit",
    });
    expect(result.triggered).toBe(true);
  });

  it("does not trigger on draft load", () => {
    const result = checkCarrierSubstitution({
      loadId: "load-1",
      previousCarrierId: "carrier-a",
      currentCarrierId: "carrier-b",
      loadStatus: "draft",
    });
    expect(result.triggered).toBe(false);
  });

  it("does not trigger when carrier is the same", () => {
    const result = checkCarrierSubstitution({
      loadId: "load-1",
      previousCarrierId: "carrier-a",
      currentCarrierId: "carrier-a",
      loadStatus: "accepted",
    });
    expect(result.triggered).toBe(false);
  });

  it("does not trigger when previous carrier was null", () => {
    const result = checkCarrierSubstitution({
      loadId: "load-1",
      previousCarrierId: null,
      currentCarrierId: "carrier-b",
      loadStatus: "accepted",
    });
    expect(result.triggered).toBe(false);
  });
});

describe("checkDomainMismatch", () => {
  it("triggers when email domains differ", () => {
    const result = checkDomainMismatch({
      carrierEmail: "dispatch@carrier.com",
      fmcsaEmail: "info@fmcsa-record.com",
      carrierId: "carrier-1",
    });
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe("high");
  });

  it("does not trigger when domains match", () => {
    const result = checkDomainMismatch({
      carrierEmail: "dispatch@carrier.com",
      fmcsaEmail: "safety@carrier.com",
      carrierId: "carrier-1",
    });
    expect(result.triggered).toBe(false);
  });

  it("does not trigger when carrier email is null", () => {
    const result = checkDomainMismatch({
      carrierEmail: null,
      fmcsaEmail: "info@fmcsa.com",
      carrierId: "carrier-1",
    });
    expect(result.triggered).toBe(false);
  });

  it("does not trigger when fmcsa email is null", () => {
    const result = checkDomainMismatch({
      carrierEmail: "test@carrier.com",
      fmcsaEmail: null,
      carrierId: "carrier-1",
    });
    expect(result.triggered).toBe(false);
  });

  it("is case-insensitive for domain comparison", () => {
    const result = checkDomainMismatch({
      carrierEmail: "test@Carrier.COM",
      fmcsaEmail: "info@carrier.com",
      carrierId: "carrier-1",
    });
    expect(result.triggered).toBe(false);
  });
});

describe("checkOffLocationPickup", () => {
  it("triggers when pickup is more than 5 miles away", () => {
    // NYC to Newark ~10 miles
    const result = checkOffLocationPickup({
      verificationLat: 40.7128,
      verificationLng: -74.006,
      originLat: 40.7357,
      originLng: -74.1724,
      loadId: "load-1",
    });
    expect(result.triggered).toBe(true);
    expect(result.alertType).toBe("off_location_pickup");
  });

  it("does not trigger when pickup is within 5 miles", () => {
    // Same location
    const result = checkOffLocationPickup({
      verificationLat: 40.7128,
      verificationLng: -74.006,
      originLat: 40.7128,
      originLng: -74.006,
      loadId: "load-1",
    });
    expect(result.triggered).toBe(false);
  });

  it("respects custom maxMiles", () => {
    const result = checkOffLocationPickup({
      verificationLat: 40.7128,
      verificationLng: -74.006,
      originLat: 40.7357,
      originLng: -74.1724,
      loadId: "load-1",
      maxMiles: 20,
    });
    expect(result.triggered).toBe(false);
  });

  it("includes distance in metadata", () => {
    const result = checkOffLocationPickup({
      verificationLat: 40.7128,
      verificationLng: -74.006,
      originLat: 40.7128,
      originLng: -74.006,
      loadId: "load-1",
    });
    expect(result.metadata?.distance).toBeDefined();
  });
});

describe("checkFailedVerification", () => {
  it("triggers at 3 attempts (default threshold)", () => {
    const result = checkFailedVerification({ loadId: "load-1", attempts: 3 });
    expect(result.triggered).toBe(true);
    expect(result.severity).toBe("critical");
  });

  it("triggers above threshold", () => {
    const result = checkFailedVerification({ loadId: "load-1", attempts: 5 });
    expect(result.triggered).toBe(true);
  });

  it("does not trigger below threshold", () => {
    const result = checkFailedVerification({ loadId: "load-1", attempts: 2 });
    expect(result.triggered).toBe(false);
  });

  it("respects custom maxAttempts", () => {
    const result = checkFailedVerification({
      loadId: "load-1",
      attempts: 3,
      maxAttempts: 5,
    });
    expect(result.triggered).toBe(false);
  });
});

describe("checkDocumentExpiration", () => {
  it("triggers for document expiring within 30 days", () => {
    const result = checkDocumentExpiration({
      carrierId: "carrier-1",
      documentId: "doc-1",
      documentType: "insurance_cert",
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
    });
    expect(result.triggered).toBe(true);
  });

  it("does not trigger for document expiring in 31+ days", () => {
    const result = checkDocumentExpiration({
      carrierId: "carrier-1",
      documentId: "doc-1",
      documentType: "insurance_cert",
      expiresAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000), // 35 days
    });
    expect(result.triggered).toBe(false);
  });

  it("does not trigger for already expired document", () => {
    const result = checkDocumentExpiration({
      carrierId: "carrier-1",
      documentId: "doc-1",
      documentType: "insurance_cert",
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
    });
    expect(result.triggered).toBe(false);
  });

  it("returns critical severity for 7 days or less", () => {
    const result = checkDocumentExpiration({
      carrierId: "carrier-1",
      documentId: "doc-1",
      documentType: "insurance_cert",
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
    expect(result.severity).toBe("critical");
  });

  it("returns high severity for 8-14 days", () => {
    const result = checkDocumentExpiration({
      carrierId: "carrier-1",
      documentId: "doc-1",
      documentType: "insurance_cert",
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
    expect(result.severity).toBe("high");
  });

  it("returns medium severity for 15-30 days", () => {
    const result = checkDocumentExpiration({
      carrierId: "carrier-1",
      documentId: "doc-1",
      documentType: "insurance_cert",
      expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    });
    expect(result.severity).toBe("medium");
  });
});

describe("checkFmcsaStatusChange", () => {
  it("triggers when status changes", () => {
    const result = checkFmcsaStatusChange({
      carrierId: "carrier-1",
      dotNumber: "123456",
      previousStatus: "AUTHORIZED",
      currentStatus: "NOT_AUTHORIZED",
    });
    expect(result.triggered).toBe(true);
    expect(result.alertType).toBe("fmcsa_status_change");
  });

  it("returns critical severity for NOT_AUTHORIZED", () => {
    const result = checkFmcsaStatusChange({
      carrierId: "carrier-1",
      dotNumber: "123456",
      previousStatus: "AUTHORIZED",
      currentStatus: "NOT_AUTHORIZED",
    });
    expect(result.severity).toBe("critical");
  });

  it("returns critical severity for OUT_OF_SERVICE", () => {
    const result = checkFmcsaStatusChange({
      carrierId: "carrier-1",
      dotNumber: "123456",
      previousStatus: "AUTHORIZED",
      currentStatus: "OUT_OF_SERVICE",
    });
    expect(result.severity).toBe("critical");
  });

  it("returns high severity for non-downgrade changes", () => {
    const result = checkFmcsaStatusChange({
      carrierId: "carrier-1",
      dotNumber: "123456",
      previousStatus: "AUTHORIZED",
      currentStatus: "CONDITIONAL",
    });
    expect(result.severity).toBe("high");
  });

  it("does not trigger when status is the same", () => {
    const result = checkFmcsaStatusChange({
      carrierId: "carrier-1",
      dotNumber: "123456",
      previousStatus: "AUTHORIZED",
      currentStatus: "AUTHORIZED",
    });
    expect(result.triggered).toBe(false);
  });

  it("does not trigger when previous status is empty", () => {
    const result = checkFmcsaStatusChange({
      carrierId: "carrier-1",
      dotNumber: "123456",
      previousStatus: "",
      currentStatus: "AUTHORIZED",
    });
    expect(result.triggered).toBe(false);
  });

  it("does not trigger when current status is empty", () => {
    const result = checkFmcsaStatusChange({
      carrierId: "carrier-1",
      dotNumber: "123456",
      previousStatus: "AUTHORIZED",
      currentStatus: "",
    });
    expect(result.triggered).toBe(false);
  });
});
