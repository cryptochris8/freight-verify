export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

type Listener = (event: SSEEvent) => void;

/**
 * Simple in-process event emitter for SSE broadcasting.
 * Each serverless invocation has its own instance — this works
 * because SSE connections live within the same process as the
 * mutations that trigger broadcasts.
 */
class SSEEmitter {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(orgId: string, listener: Listener): () => void {
    if (!this.listeners.has(orgId)) {
      this.listeners.set(orgId, new Set());
    }
    this.listeners.get(orgId)!.add(listener);
    return () => {
      this.listeners.get(orgId)?.delete(listener);
      if (this.listeners.get(orgId)?.size === 0) {
        this.listeners.delete(orgId);
      }
    };
  }

  broadcast(orgId: string, event: SSEEvent) {
    const orgListeners = this.listeners.get(orgId);
    if (!orgListeners) return;
    for (const listener of orgListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// Singleton — shared within a single serverless invocation
export const sseEmitter = new SSEEmitter();
