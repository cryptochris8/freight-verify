import { NextResponse } from "next/server";
import { carrierCreateSchema } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { carriers } from "@/lib/db/schema";
import { eq, count, and, like, or, desc, asc } from "drizzle-orm";
import { checkAccess } from "@/lib/billing/feature-gate";
import { writeAuditLog } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (request, { orgId }) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    // Filtering
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");

    // Sorting
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const conditions: ReturnType<typeof eq>[] = [eq(carriers.orgId, orgId)];
    if (status) conditions.push(eq(carriers.status, status));
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          like(carriers.legalName, searchTerm),
          like(carriers.dotNumber, searchTerm),
          like(carriers.mcNumber, searchTerm),
        )!
      );
    }

    const whereClause = and(...conditions);

    const [totalResult] = await db.select({ value: count() }).from(carriers).where(whereClause);
    const total = totalResult?.value ?? 0;

    const sortCol = sortBy === "legalName" ? carriers.legalName
      : sortBy === "status" ? carriers.status
      : sortBy === "dotNumber" ? carriers.dotNumber
      : carriers.createdAt;
    const orderFn = sortOrder === "asc" ? asc : desc;

    const items = await db
      .select()
      .from(carriers)
      .where(whereClause)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    logger.error("CARRIERS", "GET request failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { userId, orgId }) => {
  try {
    const rl = await rateLimit(`carriers:${orgId}`, 30, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before adding more carriers." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    const access = await checkAccess(orgId, "carrierLimit");
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.reason ?? "Carrier limit reached" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = carrierCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const [carrier] = await db
      .insert(carriers)
      .values({
        orgId,
        dotNumber: data.dotNumber,
        mcNumber: data.mcNumber || null,
        legalName: data.legalName || null,
        dbaName: data.dbaName || null,
        email: data.email || null,
        phone: data.phone || null,
        status: "pending",
      })
      .returning();

    await writeAuditLog({
      orgId,
      entityType: "carrier",
      entityId: carrier.id,
      action: "carrier_created",
      actorId: userId,
      actorType: "user",
      metadata: { dotNumber: data.dotNumber, legalName: data.legalName },
    });

    return NextResponse.json({ carrier }, { status: 201 });
  } catch (error) {
    logger.error("CARRIERS", "POST request failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
