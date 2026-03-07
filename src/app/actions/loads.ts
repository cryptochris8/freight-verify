"use server";

import { db } from "@/lib/db";
import { loads, loadEvents, carriers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { loadFormSchema, type LoadFormValues } from "@/lib/loads/validation";
import { transitionStatus, type LoadStatus } from "@/lib/loads/status-engine";
import { assignCarrier } from "@/lib/loads/assignment";
import { createChainedEvent } from "@/lib/events/create-event";
import { checkAccess } from "@/lib/billing/feature-gate";
import crypto from "crypto";

export async function createLoad(values: LoadFormValues, orgId: string, userId: string) {
  const access = await checkAccess(orgId, "loadLimit");
  if (!access.allowed) {
    return { success: false as const, error: access.reason ?? "Load limit reached" };
  }

  const parsed = loadFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten().fieldErrors };
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

  if (data.carrierId) {
    await assignCarrier(load.id, data.carrierId, userId, orgId);
  }

  revalidatePath("/loads");
  return { success: true as const, loadId: load.id };
}

export async function updateLoad(loadId: string, values: LoadFormValues, orgId: string, userId: string) {
  const parsed = loadFormSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const rateCents = data.rateDollars ? Math.round(parseFloat(data.rateDollars) * 100) : null;
  const weightLbs = data.weightLbs ? parseInt(data.weightLbs, 10) : null;

  await db.update(loads).set({
    referenceNumber: data.referenceNumber,
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
    updatedAt: new Date(),
  }).where(and(eq(loads.id, loadId), eq(loads.orgId, orgId)));

  revalidatePath("/loads");
  return { success: true as const };
}

export async function deleteLoad(loadId: string, orgId: string) {
  const [load] = await db.select().from(loads).where(and(eq(loads.id, loadId), eq(loads.orgId, orgId))).limit(1);
  if (!load) return { success: false as const, error: "Load not found" };
  if (load.status !== "draft") return { success: false as const, error: "Only draft loads can be deleted" };

  await db.delete(loadEvents).where(eq(loadEvents.loadId, loadId));
  await db.delete(loads).where(eq(loads.id, loadId));

  revalidatePath("/loads");
  return { success: true as const };
}

export async function tenderLoad(loadId: string, orgId: string, userId: string) {
  const [load] = await db.select().from(loads).where(and(eq(loads.id, loadId), eq(loads.orgId, orgId))).limit(1);
  if (!load) return { success: false as const, error: "Load not found" };
  if (load.status !== "draft") return { success: false as const, error: "Load must be in draft status to tender" };
  if (!load.carrierId) return { success: false as const, error: "No carrier assigned" };

  const tenderToken = crypto.randomUUID();

  await db.update(loads).set({
    tenderToken,
    tenderExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  }).where(eq(loads.id, loadId));

  const result = await transitionStatus(loadId, "tendered", userId, orgId, { tenderToken });
  if (!result.success) return { success: false as const, error: result.error || "Transition failed" };

  const [carrier] = await db.select().from(carriers).where(eq(carriers.id, load.carrierId)).limit(1);
  console.log("[TENDER] Would send tender notification to carrier " + (carrier?.legalName ?? "unknown") + " (" + (carrier?.email ?? "no email") + ")");
  console.log("[TENDER] Tender link: /tender/" + tenderToken);

  revalidatePath("/loads");
  return { success: true as const, tenderToken };
}

export async function acceptTender(loadId: string, token: string) {
  const [load] = await db.select().from(loads).where(eq(loads.id, loadId)).limit(1);
  if (!load) return { success: false as const, error: "Load not found" };
  if (load.tenderToken !== token) return { success: false as const, error: "Invalid tender token" };
  if (load.status !== "tendered") return { success: false as const, error: "Load is not in tendered status" };
  if (load.tenderExpiresAt && new Date() > load.tenderExpiresAt) {
    return { success: false as const, error: "Tender has expired" };
  }

  const result = await transitionStatus(loadId, "accepted", null, load.orgId, { acceptedVia: "carrier_portal" });
  if (!result.success) return { success: false as const, error: result.error || "Failed" };

  await db.update(loads).set({ tenderToken: null, tenderExpiresAt: null }).where(eq(loads.id, loadId));

  revalidatePath("/loads");
  return { success: true as const };
}

export async function declineTender(loadId: string, token: string, reason: string) {
  const [load] = await db.select().from(loads).where(eq(loads.id, loadId)).limit(1);
  if (!load) return { success: false, error: "Load not found" };
  if (load.tenderToken !== token) return { success: false, error: "Invalid tender token" };
  if (load.status !== "tendered") return { success: false as const, error: "Load is not in tendered status" };

  const result = await transitionStatus(loadId, "draft", null, load.orgId, {
    declinedVia: "carrier_portal",
    declineReason: reason,
  });
  if (!result.success) return { success: false as const, error: result.error || "Failed" };

  await db.update(loads).set({ tenderToken: null, tenderExpiresAt: null }).where(eq(loads.id, loadId));

  revalidatePath("/loads");
  return { success: true as const };
}

export async function transitionLoadStatus(loadId: string, newStatus: LoadStatus, orgId: string, userId: string) {
  const result = await transitionStatus(loadId, newStatus, userId, orgId);
  revalidatePath("/loads");
  return result;
}
