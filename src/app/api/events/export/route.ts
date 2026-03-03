import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadEvents, loads, carriers } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
  const { orgId } = await auth();
  if (!orgId) {
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

  let filtered = events;
  if (eventTypes) {
    const types = eventTypes.split(",");
    filtered = events.filter((e) => types.some((t) => e.eventType.startsWith(t)));
  }

  const header = "timestamp,event_type,load_reference,carrier_name,description,actor,actor_type,event_hash";
  const rows = filtered.map((e) => {
    const ts = e.createdAt ? format(new Date(e.createdAt), "yyyy-MM-dd HH:mm:ss") : "";
    const escapeCsv = (v: string | null | undefined) => {
      const val = v ?? "";
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    };
    return [
      ts,
      escapeCsv(e.eventType),
      escapeCsv(e.referenceNumber),
      escapeCsv(e.carrierName),
      escapeCsv(e.description),
      e.actorId ?? "",
      e.actorType ?? "",
      e.eventHash ?? "",
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const fileName = "events-" + format(new Date(), "yyyy-MM-dd") + ".csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=\"" + fileName + "\"",
    },
  });
}
