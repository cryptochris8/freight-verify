import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadEvents } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { verifyChain } from "@/lib/events/hash-chain";

export async function GET(request: NextRequest) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loadId = request.nextUrl.searchParams.get("loadId");

  const conditions = [eq(loadEvents.orgId, orgId)];
  if (loadId) {
    conditions.push(eq(loadEvents.loadId, loadId));
  }

  // If checking a specific load, get all events for that load in order
  // If checking all loads, we verify each load separately
  if (loadId) {
    const events = await db
      .select()
      .from(loadEvents)
      .where(eq(loadEvents.loadId, loadId))
      .orderBy(asc(loadEvents.id));

    const mapped = events.map((e) => ({
      loadId: e.loadId,
      eventType: e.eventType,
      actorId: e.actorId,
      actorType: e.actorType,
      description: e.description,
      metadata: e.metadata,
      geoLat: e.geoLat,
      geoLng: e.geoLng,
      createdAt: e.createdAt ?? new Date(),
      prevHash: e.prevHash,
      eventHash: e.eventHash,
    }));

    const result = verifyChain(mapped);
    return NextResponse.json({
      valid: result.valid,
      brokenAt: result.brokenAt,
      totalEvents: events.length,
    });
  }

  // Verify all loads - get unique load IDs
  const allEvents = await db
    .select()
    .from(loadEvents)
    .where(eq(loadEvents.orgId, orgId))
    .orderBy(asc(loadEvents.id));

  // Group by loadId
  const byLoad = new Map<string, typeof allEvents>();
  for (const e of allEvents) {
    const existing = byLoad.get(e.loadId) ?? [];
    existing.push(e);
    byLoad.set(e.loadId, existing);
  }

  let allValid = true;
  let brokenLoadId: string | null = null;
  let brokenAt: number | null = null;

  for (const [lid, events] of byLoad) {
    const mapped = events.map((e) => ({
      loadId: e.loadId,
      eventType: e.eventType,
      actorId: e.actorId,
      actorType: e.actorType,
      description: e.description,
      metadata: e.metadata,
      geoLat: e.geoLat,
      geoLng: e.geoLng,
      createdAt: e.createdAt ?? new Date(),
      prevHash: e.prevHash,
      eventHash: e.eventHash,
    }));
    const result = verifyChain(mapped);
    if (!result.valid) {
      allValid = false;
      brokenLoadId = lid;
      brokenAt = result.brokenAt;
      break;
    }
  }

  return NextResponse.json({
    valid: allValid,
    brokenAt,
    brokenLoadId,
    totalEvents: allEvents.length,
    totalLoads: byLoad.size,
  });
}
