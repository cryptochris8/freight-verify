import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { loads, organizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { loadUpdateSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit";
import { createChainedEvent } from "@/lib/events/create-event";
import { rateLimit } from "@/lib/rate-limit";
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

    const [load] = await db
      .select()
      .from(loads)
      .where(and(eq(loads.id, id), eq(loads.orgId, org.id)))
      .limit(1);

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    return NextResponse.json({ load });
  } catch (error) {
    logger.error("LOADS", "GET [id] request failed", { error: String(error) });
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

    const rl = await rateLimit(`loads-patch:${org.id}`, 30, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    const { id } = await params;

    const [load] = await db
      .select()
      .from(loads)
      .where(and(eq(loads.id, id), eq(loads.orgId, org.id)))
      .limit(1);

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    if (load.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft loads can be edited" },
        { status: 409 }
      );
    }

    const body = await request.json();
    const parsed = loadUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.originName !== undefined) updates.originName = data.originName;
    if (data.originAddress !== undefined) updates.originAddress = data.originAddress;
    if (data.originLat !== undefined) updates.originLat = data.originLat || null;
    if (data.originLng !== undefined) updates.originLng = data.originLng || null;
    if (data.destinationName !== undefined) updates.destinationName = data.destinationName;
    if (data.destinationAddress !== undefined) updates.destinationAddress = data.destinationAddress;
    if (data.destinationLat !== undefined) updates.destinationLat = data.destinationLat || null;
    if (data.destinationLng !== undefined) updates.destinationLng = data.destinationLng || null;
    if (data.pickupDate !== undefined) updates.pickupDate = new Date(data.pickupDate);
    if (data.deliveryDate !== undefined) updates.deliveryDate = data.deliveryDate ? new Date(data.deliveryDate) : null;
    if (data.commodity !== undefined) updates.commodity = data.commodity || null;
    if (data.weightLbs !== undefined) updates.weightLbs = data.weightLbs ? parseInt(data.weightLbs, 10) : null;
    if (data.specialInstructions !== undefined) updates.specialInstructions = data.specialInstructions || null;
    if (data.rateDollars !== undefined) updates.rateCents = data.rateDollars ? Math.round(parseFloat(data.rateDollars) * 100) : null;
    if (data.carrierId !== undefined) updates.carrierId = data.carrierId || null;

    await db.update(loads).set(updates).where(eq(loads.id, id));

    await createChainedEvent({
      loadId: id,
      orgId: org.id,
      eventType: "load_updated",
      actorId: userId,
      actorType: "user",
      description: "Load " + (load.referenceNumber ?? id) + " updated",
      metadata: data,
    });

    await writeAuditLog({
      orgId: org.id,
      entityType: "load",
      entityId: id,
      action: "load_updated",
      actorId: userId,
      actorType: "user",
      metadata: data,
    });

    const [updated] = await db
      .select()
      .from(loads)
      .where(eq(loads.id, id))
      .limit(1);

    return NextResponse.json({ load: updated });
  } catch (error) {
    logger.error("LOADS", "PATCH [id] request failed", { error: String(error) });
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

    const rl = await rateLimit(`loads-delete:${org.id}`, 10, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    const { id } = await params;

    const [load] = await db
      .select()
      .from(loads)
      .where(and(eq(loads.id, id), eq(loads.orgId, org.id)))
      .limit(1);

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    if (load.status !== "draft" && load.status !== "cancelled") {
      return NextResponse.json(
        { error: "Only draft or cancelled loads can be deleted" },
        { status: 409 }
      );
    }

    // Hard delete — cascades to events, verifications, documents, messages via FK constraints
    await db.delete(loads).where(eq(loads.id, id));

    await writeAuditLog({
      orgId: org.id,
      entityType: "load",
      entityId: id,
      action: "load_deleted",
      actorId: userId,
      actorType: "user",
      metadata: { referenceNumber: load.referenceNumber, status: load.status },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("LOADS", "DELETE [id] request failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
