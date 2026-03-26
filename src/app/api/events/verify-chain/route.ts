import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadEvents, loads } from "@/lib/db/schema";
import { eq, asc, and, count } from "drizzle-orm";
import { resolveOrgId } from "@/lib/auth";
import { verifyChain } from "@/lib/events/hash-chain";

const MAX_LOADS_PER_REQUEST = 50;

function mapEvents(events: typeof loadEvents.$inferSelect[]) {
  return events.map((e) => ({
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
}

export async function GET(request: NextRequest) {
  let orgId: string;
  try {
    ({ orgId } = await resolveOrgId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loadId = request.nextUrl.searchParams.get("loadId");

  // Single load verification
  if (loadId) {
    const events = await db
      .select()
      .from(loadEvents)
      .where(and(eq(loadEvents.loadId, loadId), eq(loadEvents.orgId, orgId)))
      .orderBy(asc(loadEvents.id));

    const result = verifyChain(mapEvents(events));
    return NextResponse.json({
      valid: result.valid,
      brokenAt: result.brokenAt,
      totalEvents: events.length,
    });
  }

  // Multi-load verification: paginated to prevent unbounded memory usage.
  // Verifies up to MAX_LOADS_PER_REQUEST loads per call.
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10));
  const limit = Math.min(
    MAX_LOADS_PER_REQUEST,
    Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || String(MAX_LOADS_PER_REQUEST), 10))
  );
  const offset = (page - 1) * limit;

  // Get a bounded page of load IDs for this org
  const loadRows = await db
    .select({ id: loads.id })
    .from(loads)
    .where(eq(loads.orgId, orgId))
    .orderBy(asc(loads.id))
    .limit(limit)
    .offset(offset);

  const [totalResult] = await db
    .select({ value: count() })
    .from(loads)
    .where(eq(loads.orgId, orgId));
  const totalLoads = totalResult?.value ?? 0;

  let allValid = true;
  let brokenLoadId: string | null = null;
  let brokenAt: number | null = null;
  let totalEventsChecked = 0;

  // Verify each load's chain individually (bounded by page size)
  for (const { id: lid } of loadRows) {
    const events = await db
      .select()
      .from(loadEvents)
      .where(eq(loadEvents.loadId, lid))
      .orderBy(asc(loadEvents.id));

    totalEventsChecked += events.length;

    const result = verifyChain(mapEvents(events));
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
    totalEventsChecked,
    loadsChecked: loadRows.length,
    totalLoads,
    page,
    totalPages: Math.ceil(totalLoads / limit),
  });
}
