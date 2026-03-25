import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/db", () => {
  const mockTx = {
    select: vi.fn(),
    insert: vi.fn(),
  };
  return {
    db: {
      transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
      _mockTx: mockTx,
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  loadEvents: {
    eventHash: "eventHash",
    loadId: "loadId",
    id: "id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
}));

vi.mock("@/lib/events/hash-chain", () => ({
  computeEventHash: vi.fn().mockReturnValue("abc123hash"),
}));

vi.mock("@/lib/sse/emitter", () => ({
  sseEmitter: {
    broadcast: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { sseEmitter } from "@/lib/sse/emitter";
import { computeEventHash } from "@/lib/events/hash-chain";

// Ensure the mock is recognized as a vi.fn()
const mockComputeEventHash = vi.mocked(computeEventHash);

describe("createChainedEvent", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockTx = (db as any)._mockTx;

    // Default: no previous events
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    };
    mockTx.select.mockReturnValue(selectChain);

    // Default: insert returns a mock event
    mockTx.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 1,
          loadId: "load-1",
          eventType: "test_event",
          eventHash: "abc123hash",
          prevHash: null,
        }]),
      }),
    });
  });

  async function getModule() {
    return await import("@/lib/events/create-event");
  }

  const baseInput = {
    loadId: "load-1",
    orgId: "org-1",
    eventType: "test_event",
    actorId: "user-1",
    actorType: "user" as const,
    description: "Test event created",
  };

  it("creates an event with computed hash", async () => {
    const { createChainedEvent } = await getModule();
    const event = await createChainedEvent(baseInput);

    expect(event).toBeDefined();
    expect(event.eventHash).toBe("abc123hash");
    expect(mockComputeEventHash).toHaveBeenCalled();
  });

  it("passes null as prevHash when no prior events exist", async () => {
    const { createChainedEvent } = await getModule();
    await createChainedEvent(baseInput);

    expect(mockComputeEventHash).toHaveBeenCalledWith(
      expect.objectContaining({ loadId: "load-1", eventType: "test_event" }),
      null
    );
  });

  it("passes previous event hash when prior events exist", async () => {
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ eventHash: "prev-hash-xyz" }]),
            }),
          }),
        }),
      }),
    };
    mockTx.select.mockReturnValue(selectChain);

    const { createChainedEvent } = await getModule();
    await createChainedEvent(baseInput);

    expect(mockComputeEventHash).toHaveBeenCalledWith(
      expect.objectContaining({ loadId: "load-1" }),
      "prev-hash-xyz"
    );
  });

  it("broadcasts to SSE after event creation", async () => {
    const { createChainedEvent } = await getModule();
    await createChainedEvent(baseInput);

    expect(sseEmitter.broadcast).toHaveBeenCalledWith("org-1", {
      type: "event_created",
      data: {
        loadId: "load-1",
        eventType: "test_event",
        description: "Test event created",
      },
    });
  });

  it("does not throw if SSE broadcast fails", async () => {
    vi.mocked(sseEmitter.broadcast).mockImplementation(() => {
      throw new Error("SSE down");
    });

    const { createChainedEvent } = await getModule();
    // Should not throw
    const event = await createChainedEvent(baseInput);
    expect(event).toBeDefined();
  });

  it("uses external transaction when provided", async () => {
    const externalTx = { ...mockTx };
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            for: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    };
    externalTx.select = vi.fn().mockReturnValue(selectChain);
    externalTx.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 2, loadId: "load-1", eventType: "test_event",
          eventHash: "abc123hash", prevHash: null,
        }]),
      }),
    });

    const { createChainedEvent } = await getModule();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = await createChainedEvent(baseInput, externalTx as any);

    expect(event).toBeDefined();
    // Should NOT have called db.transaction since we passed an external tx
    expect(db.transaction).not.toHaveBeenCalled();
    // Should have used the external tx
    expect(externalTx.select).toHaveBeenCalled();
  });
});
