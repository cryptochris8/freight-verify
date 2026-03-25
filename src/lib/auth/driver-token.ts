import { db } from "@/lib/db";
import { loads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Validates a driver token from the request and returns the associated load.
 *
 * Accepts the token via:
 *   - `Authorization: Bearer <token>` header
 *   - `x-driver-token` header
 *
 * Returns the load row if the token is valid, or null otherwise.
 */
export async function validateDriverToken(request: Request) {
  const token = extractToken(request);
  if (!token) return null;

  const [load] = await db
    .select()
    .from(loads)
    .where(eq(loads.driverToken, token))
    .limit(1);

  return load ?? null;
}

/**
 * Validates that a driver token matches a specific loadId.
 * Used for endpoints that receive both a loadId param and a token.
 */
export async function validateDriverTokenForLoad(
  request: Request,
  loadId: string
) {
  const load = await validateDriverToken(request);
  if (!load) return null;
  if (load.id !== loadId) return null;
  return load;
}

function extractToken(request: Request): string | null {
  // Check Authorization: Bearer <token>
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  // Check x-driver-token header
  const driverToken = request.headers.get("x-driver-token");
  if (driverToken?.trim()) return driverToken.trim();

  return null;
}
