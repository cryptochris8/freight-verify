"use server";

import { db } from "@/lib/db";
import { alerts, loads, carriers } from "@/lib/db/schema";
import { eq, and, count, sql, gte, desc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function acknowledgeAlert(alertId: string, notes: string) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { success: false as const, error: "Unauthorized" };

  const [alert] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.orgId, orgId)))
    .limit(1);

  if (!alert) return { success: false as const, error: "Alert not found" };

  await db
    .update(alerts)
    .set({
      status: "acknowledged",
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
      acknowledgeNote: notes || null,
    })
    .where(eq(alerts.id, alertId));

  revalidatePath("/alerts");
  revalidatePath("/alerts/" + alertId);
  revalidatePath("/");
  return { success: true as const };
}

export async function bulkAcknowledgeAlerts(alertIds: string[], notes: string) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { success: false as const, error: "Unauthorized" };
  if (alertIds.length === 0) return { success: false as const, error: "No alerts selected" };

  for (const alertId of alertIds) {
    await db
      .update(alerts)
      .set({
        status: "acknowledged",
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        acknowledgeNote: notes || null,
      })
      .where(and(eq(alerts.id, alertId), eq(alerts.orgId, orgId)));
  }

  revalidatePath("/alerts");
  revalidatePath("/");
  return { success: true as const, count: alertIds.length };
}

export async function getAlertStats(orgId: string) {
  const [critical] = await db
    .select({ value: count() })
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), eq(alerts.severity, "critical"), eq(alerts.status, "open")));

  const [high] = await db
    .select({ value: count() })
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), eq(alerts.severity, "high"), eq(alerts.status, "open")));

  const [medium] = await db
    .select({ value: count() })
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), eq(alerts.severity, "medium"), eq(alerts.status, "open")));

  const [acknowledged] = await db
    .select({ value: count() })
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), eq(alerts.status, "acknowledged")));

  const [total] = await db
    .select({ value: count() })
    .from(alerts)
    .where(eq(alerts.orgId, orgId));

  return {
    critical: critical?.value ?? 0,
    high: high?.value ?? 0,
    medium: medium?.value ?? 0,
    acknowledged: acknowledged?.value ?? 0,
    total: total?.value ?? 0,
  };
}

export async function getAlertDetail(alertId: string) {
  const { orgId } = await auth();
  if (!orgId) return null;

  const [alert] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.orgId, orgId)))
    .limit(1);

  if (!alert) return null;

  let load = null;
  if (alert.loadId) {
    const [l] = await db.select().from(loads).where(eq(loads.id, alert.loadId)).limit(1);
    load = l ?? null;
  }

  let carrier = null;
  if (alert.carrierId) {
    const [c] = await db.select().from(carriers).where(eq(carriers.id, alert.carrierId)).limit(1);
    carrier = c ?? null;
  }

  return { alert, load, carrier };
}
