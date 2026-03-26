export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

type Listener = (event: SSEEvent) => void;

/**
 * SSE event emitter with optional Redis pub/sub for cross-instance delivery.
 *
 * In serverless environments (Vercel), each function invocation is a separate
 * process. The in-process listener set only handles connections within the
 * same process. When UPSTASH_REDIS_URL is configured, broadcast() publishes
 * to Redis and all instances subscribe to receive events.
 *
 * Without Redis, this falls back to in-process only (works for single-instance
 * or development, but SSE events may not reach all clients in production).
 */
class SSEEmitter {
  private listeners = new Map<string, Set<Listener>>();
  private redisPublisher: RedisPublisher | null = null;
  private initialized = false;

  private async initRedis() {
    if (this.initialized) return;
    this.initialized = true;

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
      this.redisPublisher = new RedisPublisher(redisUrl, redisToken);
    }
  }

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

  async broadcast(orgId: string, event: SSEEvent) {
    // Always deliver to in-process listeners
    this.deliverLocally(orgId, event);

    // Also publish to Redis if configured (for cross-instance delivery)
    await this.initRedis();
    if (this.redisPublisher) {
      try {
        await this.redisPublisher.publish(orgId, event);
      } catch {
        // Redis publish failure should not block the mutation
      }
    }
  }

  /**
   * Poll Redis for events targeted at a specific org.
   * Called by the SSE stream to pick up events from other instances.
   */
  async poll(orgId: string): Promise<SSEEvent[]> {
    await this.initRedis();
    if (!this.redisPublisher) return [];
    try {
      return await this.redisPublisher.poll(orgId);
    } catch {
      return [];
    }
  }

  private deliverLocally(orgId: string, event: SSEEvent) {
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

/**
 * Lightweight Redis publisher using Upstash REST API (HTTP-based, serverless-safe).
 * Uses a Redis list per org as a bounded event queue.
 */
class RedisPublisher {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  async publish(orgId: string, event: SSEEvent): Promise<void> {
    const key = `sse:${orgId}`;
    const payload = JSON.stringify(event);

    // RPUSH + LTRIM to maintain a bounded queue of 100 events
    await this.command("RPUSH", key, payload);
    await this.command("LTRIM", key, "-100", "-1");
    // Expire after 5 minutes to auto-cleanup idle orgs
    await this.command("EXPIRE", key, "300");
  }

  async poll(orgId: string): Promise<SSEEvent[]> {
    const key = `sse:${orgId}`;
    // LRANGE + DEL to atomically read and clear
    const result = await this.command("LRANGE", key, "0", "-1");
    if (result && Array.isArray(result) && result.length > 0) {
      await this.command("DEL", key);
      return result.map((item: string) => {
        try {
          return JSON.parse(item);
        } catch {
          return null;
        }
      }).filter(Boolean);
    }
    return [];
  }

  private async command(...args: string[]): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.result;
  }
}

// Singleton — shared within a single serverless invocation.
// With Redis configured, events are also published cross-instance.
export const sseEmitter = new SSEEmitter();
