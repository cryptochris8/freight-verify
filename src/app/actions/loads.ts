"use server";

import { db } from "@/lib/db";
import { loads, loadEvents, carriers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { type LoadFormValues } from "@/lib/loads/validation";
import { transitionStatus, type LoadStatus } from "@/lib/loads/status-engine";
import { createChainedEvent } from "@/lib/events/create-event";
import { sendTenderNotification } from "@/lib/notifications/tender-email";
import { createLoadCore } from "@/lib/loads/create-load";
import crypto from "crypto";
import { logger } from "@/lib/logger";

export async function createLoad(values: LoadFormValues, orgId: string, userId: string) {
  const result = await createLoadCore(values, orgId, userId);
  if (!result.success) {
    return { success: false as const, error: result.error };
  }
  revalidatePath("/loads");
  return { success: true as const, loadId: result.load.id };
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
  const tenderToken = crypto.randomUUID();
  const tenderExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  // Wrap token write + status transition in a single transaction to prevent
  // race conditions where a token is set but the status transition fails.
  const txResult = await db.transaction(async (tx) => {
    const [load] = await tx.select().from(loads)
      .where(and(eq(loads.id, loadId), eq(loads.orgId, orgId))).limit(1);
    if (!load) return { success: false as const, error: "Load not found" };
    if (load.status !== "draft") return { success: false as const, error: "Load must be in draft status to tender" };
    if (!load.carrierId) return { success: false as const, error: "No carrier assigned" };

    await tx.update(loads).set({
      tenderToken,
      tenderExpiresAt,
      updatedAt: new Date(),
    }).where(eq(loads.id, loadId));

    return { success: true as const, carrierId: load.carrierId, referenceNumber: load.referenceNumber };
  });

  if (!txResult.success) return txResult;

  // transitionStatus uses its own transaction with FOR UPDATE locking
  const result = await transitionStatus(loadId, "tendered", userId, orgId, { tenderToken });
  if (!result.success) {
    // Rollback the token if transition fails
    await db.update(loads).set({ tenderToken: null, tenderExpiresAt: null, updatedAt: new Date() })
      .where(eq(loads.id, loadId));
    return { success: false as const, error: result.error || "Transition failed" };
  }

  const [carrier] = await db.select().from(carriers).where(eq(carriers.id, txResult.carrierId)).limit(1);
  if (carrier?.email) {
    await sendTenderNotification(
      carrier.email,
      carrier.legalName ?? "Carrier",
      txResult.referenceNumber ?? loadId,
      tenderToken
    );
  } else {
    logger.info("TENDER", "No email on file for carrier, skipping notification", { carrier: carrier?.legalName ?? "unknown" });
  }

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

  // Generate secure driver token for driver portal access
  const driverToken = crypto.randomBytes(32).toString("hex");
  await db.update(loads).set({ tenderToken: null, tenderExpiresAt: null, driverToken }).where(eq(loads.id, loadId));

  revalidatePath("/loads");
  return { success: true as const, driverToken };
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
