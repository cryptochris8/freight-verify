import { db } from "@/lib/db";
import { rateLimitEntries } from "@/lib/db/schema";
import { eq, lt } from "drizzle-orm";
import { logger } from "@/lib/logger";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * DB-backed rate limiter using token bucket semantics.
 * Uses Postgres for persistence across serverless invocations.
 * Fails open (allows request) if DB is unreachable.
 *
 * @param key - Unique identifier (e.g., "verify-otp:192.168.1.1")
 * @param limit - Maximum number of requests in the window
 * @param windowMs - Time window in milliseconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  try {
    return await db.transaction(async (tx) => {
      // Try to get existing entry with row lock
      const [existing] = await tx
        .select()
        .from(rateLimitEntries)
        .where(eq(rateLimitEntries.key, key))
        .for("update")
        .limit(1);

      if (!existing) {
        // First request for this key — create entry with limit-1 tokens
        await tx.insert(rateLimitEntries).values({
          key,
          tokens: String(limit - 1),
          lastRefill: now,
        });
        return { allowed: true, remaining: limit - 1, resetAt };
      }

      // Refill tokens based on elapsed time
      const elapsed = now.getTime() - existing.lastRefill.getTime();
      const refillRate = limit / windowMs;
      const tokensToAdd = elapsed * refillRate;
      const currentTokens = Math.min(limit, Number(existing.tokens) + tokensToAdd);

      if (currentTokens >= 1) {
        const newTokens = currentTokens - 1;
        await tx
          .update(rateLimitEntries)
          .set({ tokens: String(newTokens), lastRefill: now })
          .where(eq(rateLimitEntries.key, key));
        return { allowed: true, remaining: Math.floor(newTokens), resetAt };
      }

      // No tokens available — update lastRefill but don't decrement
      await tx
        .update(rateLimitEntries)
        .set({ tokens: String(currentTokens), lastRefill: now })
        .where(eq(rateLimitEntries.key, key));
      return { allowed: false, remaining: 0, resetAt };
    });
  } catch (err) {
    // Fail open: if DB is unreachable, allow the request
    logger.error("RATE_LIMIT", "DB rate limit check failed, allowing request", {
      key,
      error: String(err),
    });
    return { allowed: true, remaining: limit, resetAt };
  }
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

/**
 * Cleanup stale rate limit entries (called from daily cron).
 * Deletes entries older than 1 hour.
 */
export async function cleanupRateLimitEntries(): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const result = await db
    .delete(rateLimitEntries)
    .where(lt(rateLimitEntries.lastRefill, oneHourAgo))
    .returning({ key: rateLimitEntries.key });
  return result.length;
}
