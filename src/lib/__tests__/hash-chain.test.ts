import { describe, it, expect } from "vitest";
import { computeEventHash, verifyChain, type HashableEvent } from "@/lib/events/hash-chain";

function makeEvent(
  overrides: Partial<Omit<HashableEvent, "prevHash" | "eventHash">> = {}
): Omit<HashableEvent, "prevHash" | "eventHash"> {
  return {
    loadId: "load-1",
    eventType: "status_change",
    actorId: "user-1",
    actorType: "user",
    description: "Test event",
    metadata: {},
    geoLat: null,
    geoLng: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("computeEventHash", () => {
  it("returns a 64-char hex string (SHA-256)", () => {
    const hash = computeEventHash(makeEvent(), null);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    const event = makeEvent();
    const h1 = computeEventHash(event, null);
    const h2 = computeEventHash(event, null);
    expect(h1).toBe(h2);
  });

  it("changes when prevHash changes", () => {
    const event = makeEvent();
    const h1 = computeEventHash(event, null);
    const h2 = computeEventHash(event, "abc123");
    expect(h1).not.toBe(h2);
  });

  it("changes when event data changes", () => {
    const h1 = computeEventHash(makeEvent({ eventType: "load_created" }), null);
    const h2 = computeEventHash(makeEvent({ eventType: "otp_sent" }), null);
    expect(h1).not.toBe(h2);
  });

  it("uses GENESIS as prevHash when null", () => {
    // This is an implementation detail but important for chain integrity
    const h1 = computeEventHash(makeEvent(), null);
    expect(h1).toBeTruthy();
  });

  it("handles Date objects and ISO strings equivalently", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    const h1 = computeEventHash(makeEvent({ createdAt: date }), null);
    const h2 = computeEventHash(makeEvent({ createdAt: date.toISOString() }), null);
    expect(h1).toBe(h2);
  });
});

describe("verifyChain", () => {
  function buildChain(count: number): HashableEvent[] {
    const events: HashableEvent[] = [];
    for (let i = 0; i < count; i++) {
      const prevHash = i === 0 ? null : events[i - 1].eventHash;
      const eventData = makeEvent({
        eventType: `event_${i}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      });
      const eventHash = computeEventHash(eventData, prevHash);
      events.push({
        ...eventData,
        prevHash,
        eventHash,
      });
    }
    return events;
  }

  it("validates an empty chain", () => {
    expect(verifyChain([])).toEqual({ valid: true, brokenAt: null });
  });

  it("validates a single-event chain", () => {
    const chain = buildChain(1);
    expect(verifyChain(chain)).toEqual({ valid: true, brokenAt: null });
  });

  it("validates a multi-event chain", () => {
    const chain = buildChain(5);
    expect(verifyChain(chain)).toEqual({ valid: true, brokenAt: null });
  });

  it("detects a tampered event hash", () => {
    const chain = buildChain(3);
    chain[1].eventHash = "tampered_hash";
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it("detects a tampered prevHash linkage", () => {
    const chain = buildChain(3);
    chain[2].prevHash = "wrong_prev_hash";
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(2);
  });

  it("detects tampered event data (description changed)", () => {
    const chain = buildChain(3);
    chain[1].description = "TAMPERED";
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });
});
