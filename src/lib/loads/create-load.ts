import { db } from "@/lib/db";
import { loads } from "@/lib/db/schema";
import { loadCreateSchema, type LoadCreateInput } from "@/lib/validation/schemas";
import { createChainedEvent } from "@/lib/events/create-event";
import { writeAuditLog } from "@/lib/audit";
import { checkAccess } from "@/lib/billing/feature-gate";
import { assignCarrier } from "@/lib/loads/assignment";

/**
 * Core load creation logic shared between the Server Action and API route.
 * Validates input, enforces billing limits, creates the load, and writes
 * the audit trail. Callers are responsible for auth, rate limiting, and revalidation.
 */
export async function createLoadCore(
  values: unknown,
  orgId: string,
  userId: string
): Promise<
  | { success: true; load: typeof loads.$inferSelect }
  | { success: false; error: string | Record<string, string[]>; status?: number }
> {
  // Feature gate check
  const access = await checkAccess(orgId, "loadLimit");
  if (!access.allowed) {
    return { success: false, error: access.reason ?? "Load limit reached", status: 403 };
  }

  // Validate with the canonical schema
  const parsed = loadCreateSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: parsed.error.flatten().fieldErrors, status: 400 };
  }

  const data = parsed.data;
  const rateCents = data.rateDollars ? Math.round(parseFloat(data.rateDollars) * 100) : null;
  const weightLbs = data.weightLbs ? parseInt(data.weightLbs, 10) : null;

  const [load] = await db.insert(loads).values({
    orgId,
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
  }).returning();

  await createChainedEvent({
    loadId: load.id,
    orgId,
    eventType: "load_created",
    actorId: userId,
    actorType: "user",
    description: "Load " + data.referenceNumber + " created",
    metadata: { referenceNumber: data.referenceNumber },
  });

  await writeAuditLog({
    orgId,
    entityType: "load",
    entityId: load.id,
    action: "load_created",
    actorId: userId,
    actorType: "user",
    metadata: { referenceNumber: data.referenceNumber },
  });

  if (data.carrierId) {
    await assignCarrier(load.id, data.carrierId, userId, orgId);
  }

  return { success: true, load };
}
