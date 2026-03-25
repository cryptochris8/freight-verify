import { describe, it, expect } from "vitest";
import { isValidTransition, getAvailableTransitions, type LoadStatus } from "@/lib/loads/status-engine";

describe("isValidTransition", () => {
  const validCases: [LoadStatus, LoadStatus][] = [
    ["draft", "tendered"],
    ["draft", "cancelled"],
    ["tendered", "accepted"],
    ["tendered", "draft"],
    ["tendered", "cancelled"],
    ["accepted", "in_transit"],
    ["accepted", "cancelled"],
    ["in_transit", "delivered"],
    ["in_transit", "cancelled"],
    ["delivered", "completed"],
    ["delivered", "cancelled"],
  ];

  for (const [from, to] of validCases) {
    it(`allows ${from} -> ${to}`, () => {
      expect(isValidTransition(from, to)).toBe(true);
    });
  }

  const invalidCases: [LoadStatus, LoadStatus][] = [
    ["draft", "accepted"],
    ["draft", "in_transit"],
    ["draft", "delivered"],
    ["draft", "completed"],
    ["tendered", "in_transit"],
    ["tendered", "delivered"],
    ["tendered", "completed"],
    ["accepted", "draft"],
    ["accepted", "tendered"],
    ["accepted", "delivered"],
    ["accepted", "completed"],
    ["in_transit", "draft"],
    ["in_transit", "tendered"],
    ["in_transit", "accepted"],
    ["in_transit", "completed"],
    ["delivered", "draft"],
    ["delivered", "tendered"],
    ["delivered", "accepted"],
    ["delivered", "in_transit"],
    ["completed", "draft"],
    ["completed", "cancelled"],
    ["cancelled", "draft"],
    ["cancelled", "cancelled"],
  ];

  for (const [from, to] of invalidCases) {
    it(`rejects ${from} -> ${to}`, () => {
      expect(isValidTransition(from, to)).toBe(false);
    });
  }
});

describe("getAvailableTransitions", () => {
  it("returns tendered and cancelled for draft", () => {
    const transitions = getAvailableTransitions("draft");
    expect(transitions).toContain("tendered");
    expect(transitions).toContain("cancelled");
  });

  it("returns accepted, draft, and cancelled for tendered", () => {
    const transitions = getAvailableTransitions("tendered");
    expect(transitions).toContain("accepted");
    expect(transitions).toContain("draft");
    expect(transitions).toContain("cancelled");
  });

  it("returns in_transit and cancelled for accepted", () => {
    const transitions = getAvailableTransitions("accepted");
    expect(transitions).toContain("in_transit");
    expect(transitions).toContain("cancelled");
  });

  it("returns delivered and cancelled for in_transit", () => {
    const transitions = getAvailableTransitions("in_transit");
    expect(transitions).toContain("delivered");
    expect(transitions).toContain("cancelled");
  });

  it("returns completed and cancelled for delivered", () => {
    const transitions = getAvailableTransitions("delivered");
    expect(transitions).toContain("completed");
    expect(transitions).toContain("cancelled");
  });

  it("returns empty for completed", () => {
    expect(getAvailableTransitions("completed")).toEqual([]);
  });

  it("returns empty for cancelled", () => {
    expect(getAvailableTransitions("cancelled")).toEqual([]);
  });
});
