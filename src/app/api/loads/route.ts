import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { loadCreateSchema } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { loads, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createChainedEvent } from "@/lib/events/create-event";

export async function GET() {
  try {
    const { orgId: clerkOrgId } = await auth();
    if (!clerkOrgId) {
      return NextResponse.json({ loads: [] });
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .limit(1);

    if (!org) {
      return NextResponse.json({ loads: [] });
    }

    const orgLoads = await db
      .select()
      .from(loads)
      .where(eq(loads.orgId, org.id));

    return NextResponse.json({ loads: orgLoads });
  } catch (error) {
    console.error("[LOADS GET]", error);
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

    const rl = rateLimit(`loads:${org.id}`, 30, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before creating more loads." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const parsed = loadCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const rateCents = data.rateDollars ? Math.round(parseFloat(data.rateDollars) * 100) : null;
    const weightLbs = data.weightLbs ? parseInt(data.weightLbs, 10) : null;

    const [load] = await db
      .insert(loads)
      .values({
        orgId: org.id,
        referenceNumber: data.referenceNumber,
        status: "draft",
        originName: data.originName,
        originAddress: data.originAddress,
        originLat: data.originLat || null,
        originLng: data.originLng || null,
        destinationName: data.destinationName,
        destinationAddress: data.destinationAddress,
        destinationLat: data.destinationLat || null,
        destinationLng: data.destinationLng || null,
        pickupDate: new Date(data.pickupDate),
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        commodity: data.commodity || null,
        weightLbs,
        specialInstructions: data.specialInstructions || null,
        rateCents,
        carrierId: data.carrierId || null,
        createdBy: userId,
      })
      .returning();

    await createChainedEvent({
      loadId: load.id,
      orgId: org.id,
      eventType: "load_created",
      actorId: userId,
      actorType: "user",
      description: "Load " + data.referenceNumber + " created",
      metadata: { referenceNumber: data.referenceNumber },
    });

    return NextResponse.json({ load }, { status: 201 });
  } catch (error) {
    console.error("[LOADS POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
