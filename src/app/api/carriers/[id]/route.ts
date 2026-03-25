import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { carriers, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { carrierUpdateSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { ForbiddenError } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const [carrier] = await db
      .select()
      .from(carriers)
      .where(and(eq(carriers.id, id), eq(carriers.orgId, org.id)))
      .limit(1);

    if (!carrier) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    return NextResponse.json({ carrier });
  } catch (error) {
    logger.error("CARRIERS", "GET [id] request failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const rl = await rateLimit(`carriers-patch:${org.id}`, 30, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    const { id } = await params;

    const [carrier] = await db
      .select()
      .from(carriers)
      .where(and(eq(carriers.id, id), eq(carriers.orgId, org.id)))
      .limit(1);

    if (!carrier) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = carrierUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.legalName !== undefined) updates.legalName = data.legalName || null;
    if (data.dbaName !== undefined) updates.dbaName = data.dbaName || null;
    if (data.email !== undefined) updates.email = data.email || null;
    if (data.phone !== undefined) updates.phone = data.phone || null;
    if (data.mcNumber !== undefined) updates.mcNumber = data.mcNumber || null;

    const [updated] = await db.update(carriers)
      .set(updates)
      .where(and(eq(carriers.id, id), eq(carriers.orgId, org.id)))
      .returning();

    await writeAuditLog({
      orgId: org.id,
      entityType: "carrier",
      entityId: id,
      action: "carrier_updated",
      actorId: userId,
      actorType: "user",
      metadata: data,
    });

    return NextResponse.json({ carrier: updated });
  } catch (error) {
    logger.error("CARRIERS", "PATCH [id] request failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, orgId: clerkOrgId, orgRole } = await auth();
    if (!userId || !clerkOrgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (orgRole !== "org:admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const rl = await rateLimit(`carriers-delete:${org.id}`, 10, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    const { id } = await params;

    const [carrier] = await db
      .select()
      .from(carriers)
      .where(and(eq(carriers.id, id), eq(carriers.orgId, org.id)))
      .limit(1);

    if (!carrier) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    // Hard delete — cascades to documents and verifications via FK constraints
    await db.delete(carriers).where(eq(carriers.id, id));

    await writeAuditLog({
      orgId: org.id,
      entityType: "carrier",
      entityId: id,
      action: "carrier_deleted",
      actorId: userId,
      actorType: "user",
      metadata: { dotNumber: carrier.dotNumber, legalName: carrier.legalName },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("CARRIERS", "DELETE [id] request failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
