import { db } from "@/lib/db";
import { carriers, loads, alerts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createChainedEvent } from "@/lib/events/create-event";

export interface AssignmentValidation {
  valid: boolean;
  carrier?: typeof carriers.$inferSelect;
  warnings: string[];
  errors: string[];
}

export async function validateAssignment(carrierId: string): Promise<AssignmentValidation> {
  const [carrier] = await db
    .select()
    .from(carriers)
    .where(eq(carriers.id, carrierId))
    .limit(1);

  if (!carrier) {
    return { valid: false, warnings: [], errors: ["Carrier not found"] };
  }

  const warnings: string[] = [];
  const errors: string[] = [];

  if (carrier.status !== "verified") {
    errors.push(`Carrier status is '${carrier.status}' - must be 'verified'`);
  }

  if (!carrier.insuranceOnFile) {
    warnings.push("Carrier does not have insurance on file");
  }

  // Check for critical alerts
  const criticalAlerts = await db
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.carrierId, carrierId),
        eq(alerts.severity, "critical"),
        eq(alerts.status, "open")
      )
    );

  if (criticalAlerts.length > 0) {
    errors.push(`Carrier has ${criticalAlerts.length} unresolved critical alert(s)`);
  }

  return {
    valid: errors.length === 0,
    carrier,
    warnings,
    errors,
  };
}

export async function assignCarrier(
  loadId: string,
  carrierId: string,
  actorId: string | null,
  orgId: string
): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
  const validation = await validateAssignment(carrierId);

  if (!validation.valid) {
    return { success: false, error: validation.errors.join("; ") };
  }

  await db.update(loads).set({ carrierId, updatedAt: new Date() }).where(eq(loads.id, loadId));

  await createChainedEvent({
    loadId,
    orgId,
    eventType: "carrier_assigned",
    actorId,
    actorType: actorId ? "user" : "system",
    description: `Carrier ${validation.carrier?.legalName ?? carrierId} assigned to load`,
    metadata: { carrierId, carrierName: validation.carrier?.legalName },
  });

  return { success: true, warnings: validation.warnings };
}

export async function unassignCarrier(
  loadId: string,
  actorId: string | null,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  const [load] = await db.select().from(loads).where(eq(loads.id, loadId)).limit(1);
  if (!load) return { success: false, error: "Load not found" };
  if (!load.carrierId) return { success: false, error: "No carrier assigned" };

  await db.update(loads).set({ carrierId: null, updatedAt: new Date() }).where(eq(loads.id, loadId));

  await createChainedEvent({
    loadId,
    orgId,
    eventType: "carrier_unassigned",
    actorId,
    actorType: actorId ? "user" : "system",
    description: `Carrier removed from load`,
    metadata: { previousCarrierId: load.carrierId },
  });

  return { success: true };
}
