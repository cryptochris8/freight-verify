import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { loads } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/auth";
import { createLoadCore } from "@/lib/loads/create-load";

export const GET = withAuth(async (request, { orgId }) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    const [totalResult] = await db.select({ value: count() }).from(loads).where(eq(loads.orgId, orgId));
    const total = totalResult?.value ?? 0;

    const items = await db
      .select()
      .from(loads)
      .where(eq(loads.orgId, orgId))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    logger.error("LOADS", "GET request failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { userId, orgId }) => {
  try {
    const rl = await rateLimit(`loads:${orgId}`, 30, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before creating more loads." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const result = await createLoadCore(body, orgId, userId);

    if (!result.success) {
      const status = result.status ?? 400;
      return NextResponse.json(
        { error: typeof result.error === "string" ? result.error : "Validation failed", details: typeof result.error === "object" ? result.error : undefined },
        { status }
      );
    }

    return NextResponse.json({ load: result.load }, { status: 201 });
  } catch (error) {
    logger.error("LOADS", "POST request failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
