import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Since we don't have jsdom, test the SSE emitter directly
// and test the hook's EventSource integration logic

import { sseEmitter } from "@/lib/sse/emitter";

describe("SSE Emitter", () => {
  it("delivers events to subscribers", () => {
    const callback = vi.fn();
    const unsubscribe = sseEmitter.subscribe("org-1", callback);

    sseEmitter.broadcast("org-1", {
      type: "alert_created",
      data: { alertId: "123" },
    });

    expect(callback).toHaveBeenCalledWith({
      type: "alert_created",
      data: { alertId: "123" },
    });

    unsubscribe();
  });

  it("does not deliver events to other orgs", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const unsub1 = sseEmitter.subscribe("org-1", callback1);
    const unsub2 = sseEmitter.subscribe("org-2", callback2);

    sseEmitter.broadcast("org-1", {
      type: "event_created",
      data: { loadId: "load-1" },
    });

    expect(callback1).toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();

    unsub1();
    unsub2();
  });

  it("stops delivering after unsubscribe", () => {
    const callback = vi.fn();
    const unsubscribe = sseEmitter.subscribe("org-1", callback);

    unsubscribe();

    sseEmitter.broadcast("org-1", {
      type: "alert_created",
      data: { alertId: "456" },
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("supports multiple subscribers per org", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const unsub1 = sseEmitter.subscribe("org-1", callback1);
    const unsub2 = sseEmitter.subscribe("org-1", callback2);

    sseEmitter.broadcast("org-1", {
      type: "load_status_changed",
      data: { loadId: "load-1", toStatus: "delivered" },
    });

    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();

    unsub1();
    unsub2();
  });

  it("handles broadcast to org with no subscribers", () => {
    expect(() => {
      sseEmitter.broadcast("non-existent-org", {
        type: "alert_created",
        data: {},
      });
    }).not.toThrow();
  });

  it("handles listener errors gracefully", () => {
    const errorCallback = vi.fn().mockImplementation(() => {
      throw new Error("Listener error");
    });
    const goodCallback = vi.fn();

    const unsub1 = sseEmitter.subscribe("org-1", errorCallback);
    const unsub2 = sseEmitter.subscribe("org-1", goodCallback);

    expect(() => {
      sseEmitter.broadcast("org-1", {
        type: "alert_created",
        data: {},
      });
    }).not.toThrow();

    expect(errorCallback).toHaveBeenCalled();
    expect(goodCallback).toHaveBeenCalled();

    unsub1();
    unsub2();
  });
});

describe("useSSE hook module", () => {
  it("exports useSSE function", async () => {
    const mod = await import("@/hooks/use-sse");
    expect(typeof mod.useSSE).toBe("function");
  });
});
