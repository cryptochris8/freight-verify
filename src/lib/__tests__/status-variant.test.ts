import { describe, it, expect } from "vitest";
import { getLoadStatusVariant, getCarrierStatusVariant } from "@/lib/utils/status-variant";

describe("getLoadStatusVariant", () => {
  it("returns 'default' for completed", () => {
    expect(getLoadStatusVariant("completed")).toBe("default");
  });

  it("returns 'default' for delivered", () => {
    expect(getLoadStatusVariant("delivered")).toBe("default");
  });

  it("returns 'secondary' for in_transit", () => {
    expect(getLoadStatusVariant("in_transit")).toBe("secondary");
  });

  it("returns 'secondary' for accepted", () => {
    expect(getLoadStatusVariant("accepted")).toBe("secondary");
  });

  it("returns 'outline' for draft", () => {
    expect(getLoadStatusVariant("draft")).toBe("outline");
  });

  it("returns 'outline' for tendered", () => {
    expect(getLoadStatusVariant("tendered")).toBe("outline");
  });

  it("returns 'destructive' for cancelled", () => {
    expect(getLoadStatusVariant("cancelled")).toBe("destructive");
  });

  it("returns 'secondary' for unknown status", () => {
    expect(getLoadStatusVariant("unknown")).toBe("secondary");
  });
});

describe("getCarrierStatusVariant", () => {
  it("returns 'default' for verified", () => {
    expect(getCarrierStatusVariant("verified")).toBe("default");
  });

  it("returns 'secondary' for pending", () => {
    expect(getCarrierStatusVariant("pending")).toBe("secondary");
  });

  it("returns 'destructive' for flagged", () => {
    expect(getCarrierStatusVariant("flagged")).toBe("destructive");
  });

  it("returns 'destructive' for suspended", () => {
    expect(getCarrierStatusVariant("suspended")).toBe("destructive");
  });

  it("returns 'outline' for expired", () => {
    expect(getCarrierStatusVariant("expired")).toBe("outline");
  });

  it("returns 'secondary' for null", () => {
    expect(getCarrierStatusVariant(null)).toBe("secondary");
  });
});
