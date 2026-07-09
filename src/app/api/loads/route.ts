import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { loads, loadStatusEnum } from "@/lib/db/schema";
import { eq, count, and, like, desc, asc, gte, lte, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/auth";
import { createLoadCore } from "@/lib/loads/create-load";

export const GET = withAuth(async (request, { orgId }) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    // Filtering
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");
    const carrierId = url.searchParams.get("carrierId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    // Sorting
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const conditions: ReturnType<typeof eq>[] = [eq(loads.orgId, orgId)];
    // Only filter when the query param is a valid load status (an unknown value
    // is ignored rather than pushed as a raw string into the enum column).
    if (status) {
      const s = status as (typeof loadStatusEnum.enumValues)[number];
      if (loadStatusEnum.enumValues.includes(s)) conditions.push(eq(loads.status, s));
    }
    if (carrierId) conditions.push(eq(loads.carrierId, carrierId));
    if (search) conditions.push(like(loads.referenceNumber, `%${search}%`));
    if (startDate) conditions.push(gte(loads.pickupDate, new Date(startDate)));
    if (endDate) conditions.push(lte(loads.pickupDate, new Date(endDate)));

    const whereClause = and(...conditions);

    const [totalResult] = await db.select({ value: count() }).from(loads).where(whereClause);
    const total = totalResult?.value ?? 0;

    const sortCol = sortBy === "pickupDate" ? loads.pickupDate
      : sortBy === "status" ? loads.status
      : sortBy === "referenceNumber" ? loads.referenceNumber
      : loads.createdAt;
    const orderFn = sortOrder === "asc" ? asc : desc;

    const items = await db
      .select()
      .from(loads)
      .where(whereClause)
      .orderBy(orderFn(sortCol))
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
