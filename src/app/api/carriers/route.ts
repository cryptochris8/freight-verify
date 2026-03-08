import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { carrierCreateSchema } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { carriers, organizations } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { checkAccess } from "@/lib/billing/feature-gate";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { orgId: clerkOrgId } = await auth();
    if (!clerkOrgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    const [totalResult] = await db.select({ value: count() }).from(carriers).where(eq(carriers.orgId, org.id));
    const total = totalResult?.value ?? 0;

    const items = await db
      .select()
      .from(carriers)
      .where(eq(carriers.orgId, org.id))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("[CARRIERS GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, orgId: clerkOrgId } = await auth();
    if (!userId || !clerkOrgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const rl = rateLimit(`carriers:${org.id}`, 30, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before adding more carriers." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    const access = await checkAccess(org.id, "carrierLimit");
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
        orgId: org.id,
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
      orgId: org.id,
      entityType: "carrier",
      entityId: carrier.id,
      action: "carrier_created",
      actorId: userId,
      actorType: "user",
      metadata: { dotNumber: data.dotNumber, legalName: data.legalName },
    });

    return NextResponse.json({ carrier }, { status: 201 });
  } catch (error) {
    console.error("[CARRIERS POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
