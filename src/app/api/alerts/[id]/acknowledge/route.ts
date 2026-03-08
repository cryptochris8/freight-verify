import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveOrgId } from "@/lib/auth";
import { alertAcknowledgeSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let userId: string, orgId: string;
  try {
    ({ userId, orgId } = await resolveOrgId());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = alertAcknowledgeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const notes = parsed.data.notes || "";

  const [alert] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, id), eq(alerts.orgId, orgId)))
    .limit(1);

  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  await db
    .update(alerts)
    .set({
      status: "acknowledged",
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
      acknowledgeNote: notes || null,
    })
    .where(and(eq(alerts.id, id), eq(alerts.orgId, orgId)));

  await writeAuditLog({
    orgId,
    entityType: "alert",
    entityId: id,
    action: "alert_acknowledged",
    actorId: userId,
    actorType: "user",
    metadata: { alertType: alert.alertType, severity: alert.severity },
  });

  return NextResponse.json({ success: true });
}
