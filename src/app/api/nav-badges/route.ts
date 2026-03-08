import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { alerts, loadEvents } from "@/lib/db/schema";
import { eq, and, count, gte } from "drizzle-orm";
import { resolveOrgId } from "@/lib/auth";
import { startOfDay } from "date-fns";

export async function GET() {
  let orgId: string;
  try {
    ({ orgId } = await resolveOrgId());
  } catch {
    return NextResponse.json({ alerts: 0, events: 0 });
  }

  const [alertResult] = await db
    .select({ value: count() })
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), eq(alerts.status, "open")));

  const today = startOfDay(new Date());
  const [eventResult] = await db
    .select({ value: count() })
    .from(loadEvents)
    .where(and(eq(loadEvents.orgId, orgId), gte(loadEvents.createdAt, today)));

  return NextResponse.json({
    alerts: alertResult?.value ?? 0,
    events: eventResult?.value ?? 0,
  });
}
