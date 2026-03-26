import { describe, it, expect } from "vitest";
import { getRecommendation } from "@/lib/alerts/recommendations";

describe("getRecommendation", () => {
  it("returns recommendation for carrier_substitution", () => {
    const result = getRecommendation("carrier_substitution");
    expect(result).toContain("Contact the carrier");
    expect(result).toContain("substitute carrier");
  });

  it("returns recommendation for domain_mismatch", () => {
    const result = getRecommendation("domain_mismatch");
    expect(result).toContain("email domain");
    expect(result).toContain("FMCSA");
  });

  it("returns recommendation for off_location_pickup", () => {
    const result = getRecommendation("off_location_pickup");
    expect(result).toContain("5 miles");
  });

  it("returns recommendation for failed_verification", () => {
    const result = getRecommendation("failed_verification");
    expect(result).toContain("OTP failed");
    expect(result).toContain("immediately");
  });

  it("returns recommendation for document_expiration", () => {
    const result = getRecommendation("document_expiration");
    expect(result).toContain("expiring");
    expect(result).toContain("documentation");
  });

  it("returns recommendation for fmcsa_status_change", () => {
    const result = getRecommendation("fmcsa_status_change");
    expect(result).toContain("FMCSA status");
  });

  it("returns default recommendation for unknown alert type", () => {
    const result = getRecommendation("some_unknown_type");
    expect(result).toBe("Review the alert details and take appropriate action.");
  });

  it("returns default recommendation for empty string", () => {
    const result = getRecommendation("");
    expect(result).toBe("Review the alert details and take appropriate action.");
  });
});
