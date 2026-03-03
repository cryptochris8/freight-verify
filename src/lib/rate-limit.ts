/**
 * Simple in-memory rate limiter for MVP.
 * Uses a sliding window approach with token bucket semantics.
 * Note: This is NOT distributed - for production, use Redis or similar.
 */

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.lastRefill > 300_000) {
        store.delete(key);
      }
    }
  }, 300_000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check and consume one token from the rate limiter.
 *
 * @param key - Unique identifier (e.g., "verify-otp:192.168.1.1")
 * @param limit - Maximum number of requests in the window
 * @param windowMs - Time window in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { tokens: limit, lastRefill: now };
    store.set(key, entry);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - entry.lastRefill;
  const refillRate = limit / windowMs; // tokens per ms
  const tokensToAdd = elapsed * refillRate;
  entry.tokens = Math.min(limit, entry.tokens + tokensToAdd);
  entry.lastRefill = now;

  const resetAt = new Date(now + windowMs);

  if (entry.tokens >= 1) {
    entry.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(entry.tokens),
      resetAt,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetAt,
  };
}

/**
 * Extracts the client IP from a request.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
