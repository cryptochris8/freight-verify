import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadEvents, loads, carriers } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, inArray, sql } from "drizzle-orm";
import { resolveOrgId } from "@/lib/auth";
import { format } from "date-fns";

function escapeCsv(v: string | null | undefined): string {
  const val = v ?? "";
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

export async function GET(request: NextRequest) {
  let orgId: string;
  try {
    ({ orgId } = await resolveOrgId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const loadId = searchParams.get("loadId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const eventTypes = searchParams.get("eventTypes");

  const conditions: ReturnType<typeof eq>[] = [eq(loadEvents.orgId, orgId)];

  if (loadId) {
    conditions.push(eq(loadEvents.loadId, loadId));
  }
  if (startDate) {
    conditions.push(gte(loadEvents.createdAt, new Date(startDate)));
  }
  if (endDate) {
    conditions.push(lte(loadEvents.createdAt, new Date(endDate)));
  }
  // Push eventTypes filter into SQL instead of filtering in JS
  if (eventTypes) {
    const types = eventTypes.split(",").map((t) => t.trim()).filter(Boolean);
    if (types.length > 0) {
      // Use LIKE for prefix matching: any event whose type starts with one of the given prefixes
      const likeConditions = types.map((t) =>
        sql`${loadEvents.eventType} LIKE ${t + "%"}`
      );
      conditions.push(sql`(${sql.join(likeConditions, sql` OR `)})`);
    }
  }

  const events = await db
    .select({
      id: loadEvents.id,
      eventType: loadEvents.eventType,
      description: loadEvents.description,
      actorId: loadEvents.actorId,
      actorType: loadEvents.actorType,
      eventHash: loadEvents.eventHash,
      createdAt: loadEvents.createdAt,
      loadId: loadEvents.loadId,
      referenceNumber: loads.referenceNumber,
      carrierName: carriers.legalName,
    })
    .from(loadEvents)
    .leftJoin(loads, eq(loadEvents.loadId, loads.id))
    .leftJoin(carriers, eq(loads.carrierId, carriers.id))
    .where(and(...conditions))
    .orderBy(desc(loadEvents.createdAt))
    .limit(10000);

  // Stream CSV response to avoid buffering the entire string in memory
  const header = "timestamp,event_type,load_reference,carrier_name,description,actor,actor_type,event_hash\n";
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(header));
      for (const e of events) {
        const ts = e.createdAt ? format(new Date(e.createdAt), "yyyy-MM-dd HH:mm:ss") : "";
        const row = [
          ts,
          escapeCsv(e.eventType),
          escapeCsv(e.referenceNumber),
          escapeCsv(e.carrierName),
          escapeCsv(e.description),
          e.actorId ?? "",
          e.actorType ?? "",
          e.eventHash ?? "",
        ].join(",") + "\n";
        controller.enqueue(encoder.encode(row));
      }
      controller.close();
    },
  });

  const fileName = "events-" + format(new Date(), "yyyy-MM-dd") + ".csv";

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=\"" + fileName + "\"",
    },
  });
}
