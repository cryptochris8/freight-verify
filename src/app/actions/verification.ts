"use server";

import { db } from "@/lib/db";
import {
  loads, pickupVerifications, loadEvents, alerts, carriers,
} from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { verifyOtp } from "@/lib/verification/otp";
import { createChainedEvent } from "@/lib/events/create-event";
import { generatePickupVerification } from "@/lib/verification/pickup-service";
import { checkFailedVerification, checkOffLocationPickup } from "@/lib/alerts/rules";
import { transitionStatus } from "@/lib/loads/status-engine";
import { calculateDistance } from "@/lib/verification/geo";
import { revalidatePath } from "next/cache";

export async function generateVerification(loadId: string) {
  const result = await generatePickupVerification(loadId);
  revalidatePath("/loads/" + loadId);
  return result;
}

export async function verifyPickupOtp(
  loadId: string, otp: string
): Promise<{ success: boolean; message: string; attemptsRemaining?: number }> {
  // Use a transaction for the read-then-update to prevent race conditions
  const txResult = await db.transaction(async (tx) => {
    const [verification] = await tx.select().from(pickupVerifications)
      .where(and(eq(pickupVerifications.loadId, loadId), eq(pickupVerifications.verificationStatus, "pending")))
      .orderBy(desc(pickupVerifications.createdAt)).limit(1);

    if (!verification) return { done: true as const, success: false, message: "No pending verification found for this load" };

    if (verification.otpExpiresAt && new Date() > verification.otpExpiresAt) {
      await tx.update(pickupVerifications).set({ verificationStatus: "expired", updatedAt: new Date() })
        .where(eq(pickupVerifications.id, verification.id));
      return { done: true as const, success: false, message: "Verification code has expired" };
    }

    const currentAttempts = verification.otpAttempts ?? 0;
    if (currentAttempts >= 3) {
      return { done: true as const, success: false, message: "Verification locked due to too many failed attempts", attemptsRemaining: 0 };
    }

    const isValid = verifyOtp(otp, verification.otpHash ?? "");
    const [load] = await tx.select().from(loads).where(eq(loads.id, loadId)).limit(1);
    if (!load) return { done: true as const, success: false, message: "Load not found" };

    if (isValid) {
      await tx.update(pickupVerifications)
        .set({ verificationStatus: "verified", verifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(pickupVerifications.id, verification.id));
      return { done: false as const, outcome: "verified" as const, verification, load };
    }

    const newAttempts = currentAttempts + 1;
    const attemptsRemaining = 3 - newAttempts;

    if (newAttempts >= 3) {
      await tx.update(pickupVerifications)
        .set({ otpAttempts: newAttempts, verificationStatus: "failed", updatedAt: new Date() })
        .where(eq(pickupVerifications.id, verification.id));
      return { done: false as const, outcome: "failed" as const, verification, load, newAttempts };
    }

    await tx.update(pickupVerifications).set({ otpAttempts: newAttempts, updatedAt: new Date() })
      .where(eq(pickupVerifications.id, verification.id));
    return { done: true as const, success: false, message: "Invalid code. " + attemptsRemaining + " attempt(s) remaining.", attemptsRemaining };
  });

  // Early returns from within the transaction
  if (txResult.done) {
    return { success: txResult.success, message: txResult.message, attemptsRemaining: txResult.attemptsRemaining };
  }

  // Post-transaction event creation (createChainedEvent uses its own transaction)
  if (txResult.outcome === "verified") {
    await createChainedEvent({
      loadId, orgId: txResult.load.orgId, eventType: "pickup_verified", actorId: null, actorType: "system",
      description: "Pickup OTP verified for load " + (txResult.load.referenceNumber ?? ""),
      metadata: { verificationId: txResult.verification.id },
    });
    revalidatePath("/loads/" + loadId);
    return { success: true, message: "Pickup verified successfully" };
  }

  // outcome === "failed"
  const alertResult = checkFailedVerification({ loadId, attempts: txResult.newAttempts });
  if (alertResult.triggered) {
    await db.insert(alerts).values({
      orgId: txResult.load.orgId, loadId, carrierId: txResult.load.carrierId,
      alertType: alertResult.alertType, severity: alertResult.severity,
      title: alertResult.title, message: alertResult.message, metadata: alertResult.metadata,
    });
  }
  await createChainedEvent({
    loadId, orgId: txResult.load.orgId, eventType: "verification_failed", actorId: null, actorType: "system",
    description: "Verification failed after " + txResult.newAttempts + " attempts",
    metadata: { verificationId: txResult.verification.id, attempts: txResult.newAttempts },
  });
  return { success: false, message: "Verification locked after 3 failed attempts. Contact the broker.", attemptsRemaining: 0 };
}

export async function recordArrival(
  loadId: string,
  geoData: { lat: number; lng: number; accuracy: number; timestamp: number }
): Promise<{ success: boolean; message: string; distance?: number; isWithinRange?: boolean }> {
  const [load] = await db.select().from(loads).where(eq(loads.id, loadId)).limit(1);
  if (!load) return { success: false, message: "Load not found" };
  const [verification] = await db.select().from(pickupVerifications)
    .where(eq(pickupVerifications.loadId, loadId)).orderBy(desc(pickupVerifications.createdAt)).limit(1);
  if (!verification) return { success: false, message: "No verification found for this load" };

  await db.update(pickupVerifications).set({
    geoLat: geoData.lat.toString(), geoLng: geoData.lng.toString(),
    geoAccuracy: geoData.accuracy.toString(), geoTimestamp: new Date(geoData.timestamp), updatedAt: new Date(),
  }).where(eq(pickupVerifications.id, verification.id));

  let distance: number | undefined;
  let isWithinRange = true;
  if (load.originLat && load.originLng) {
    const oLat = parseFloat(load.originLat), oLng = parseFloat(load.originLng);
    distance = calculateDistance(geoData.lat, geoData.lng, oLat, oLng);
    distance = Math.round(distance * 10) / 10;
    isWithinRange = distance <= 5;
    if (!isWithinRange) {
      const alertResult = checkOffLocationPickup({
        verificationLat: geoData.lat, verificationLng: geoData.lng,
        originLat: oLat, originLng: oLng, loadId,
      });
      if (alertResult.triggered) {
        await db.insert(alerts).values({
          orgId: load.orgId, loadId, carrierId: load.carrierId,
          alertType: alertResult.alertType, severity: alertResult.severity,
          title: alertResult.title, message: alertResult.message, metadata: alertResult.metadata,
        });
      }
    }
  }

  await createChainedEvent({
    loadId, orgId: load.orgId, eventType: "driver_arrived", actorId: null, actorType: "driver",
    description: "Driver arrived at pickup" + (distance !== undefined ? " (" + distance + " mi from origin)" : ""),
    metadata: { verificationId: verification.id, lat: geoData.lat, lng: geoData.lng, accuracy: geoData.accuracy, distance, isWithinRange },
    geoLat: geoData.lat.toString(), geoLng: geoData.lng.toString(),
  });
  revalidatePath("/loads/" + loadId);
  return { success: true,
    message: isWithinRange ? "Arrival recorded successfully" : "You appear to be " + distance + " miles from the pickup location.",
    distance, isWithinRange };
}

export async function uploadPhoto(
  loadId: string, photoData: { fileName: string; fileUrl: string; photoType: string }
): Promise<{ success: boolean; error?: string }> {
  const [verification] = await db.select().from(pickupVerifications)
    .where(eq(pickupVerifications.loadId, loadId)).orderBy(desc(pickupVerifications.createdAt)).limit(1);
  if (!verification) return { success: false, error: "No verification found" };
  const [load] = await db.select().from(loads).where(eq(loads.id, loadId)).limit(1);
  if (!load) return { success: false, error: "Load not found" };
  const newPhotos = [...(verification.photoUrls ?? []), photoData.fileUrl];
  await db.update(pickupVerifications).set({ photoUrls: newPhotos, updatedAt: new Date() })
    .where(eq(pickupVerifications.id, verification.id));
  await createChainedEvent({
    loadId, orgId: load.orgId, eventType: "photos_captured", actorId: null, actorType: "system",
    description: "Photo uploaded: " + photoData.photoType + " - " + photoData.fileName,
    metadata: { verificationId: verification.id, photoType: photoData.photoType, fileName: photoData.fileName,
      fileUrl: photoData.fileUrl, totalPhotos: newPhotos.length },
  });
  revalidatePath("/loads/" + loadId);
  return { success: true };
}

export async function getVerificationStatus(loadId: string) {
  const [verification] = await db.select().from(pickupVerifications)
    .where(eq(pickupVerifications.loadId, loadId)).orderBy(desc(pickupVerifications.createdAt)).limit(1);
  if (!verification) return { exists: false as const };
  const [load] = await db.select().from(loads).where(eq(loads.id, loadId)).limit(1);
  let carrierName: string | null = null;
  if (load?.carrierId) {
    const [carrier] = await db.select().from(carriers).where(eq(carriers.id, load.carrierId)).limit(1);
    carrierName = carrier?.legalName ?? null;
  }
  const events = await db.select().from(loadEvents)
    .where(eq(loadEvents.loadId, loadId)).orderBy(loadEvents.createdAt);
  return {
    exists: true as const,
    verification: {
      id: verification.id, loadId: verification.loadId, verificationStatus: verification.verificationStatus,
      otpExpiresAt: verification.otpExpiresAt?.toISOString() ?? null, otpAttempts: verification.otpAttempts,
      driverName: verification.driverName, driverPhone: verification.driverPhone,
      truckNumber: verification.truckNumber, trailerNumber: verification.trailerNumber,
      verifiedAt: verification.verifiedAt?.toISOString() ?? null, photoUrls: verification.photoUrls,
      geoLat: verification.geoLat, geoLng: verification.geoLng,
      geoTimestamp: verification.geoTimestamp?.toISOString() ?? null, geoAccuracy: verification.geoAccuracy,
      createdAt: verification.createdAt?.toISOString() ?? null,
    },
    load: load ? { id: load.id, referenceNumber: load.referenceNumber, originName: load.originName,
      originAddress: load.originAddress, originLat: load.originLat, originLng: load.originLng,
      pickupDate: load.pickupDate?.toISOString() ?? null, status: load.status } : null,
    carrierName,
    events: events.map((e) => ({ id: e.id, eventType: e.eventType, description: e.description,
      actorType: e.actorType, geoLat: e.geoLat, geoLng: e.geoLng, metadata: e.metadata,
      createdAt: e.createdAt?.toISOString() ?? null })),
  };
}

export async function completeVerification(loadId: string): Promise<{ success: boolean; error?: string }> {
  const [verification] = await db.select().from(pickupVerifications)
    .where(and(eq(pickupVerifications.loadId, loadId), eq(pickupVerifications.verificationStatus, "verified")))
    .orderBy(desc(pickupVerifications.createdAt)).limit(1);
  if (!verification) return { success: false, error: "No verified pickup verification found" };
  if (!verification.photoUrls || verification.photoUrls.length === 0)
    return { success: false, error: "At least one photo is required to complete verification" };
  const [load] = await db.select().from(loads).where(eq(loads.id, loadId)).limit(1);
  if (!load) return { success: false, error: "Load not found" };
  await createChainedEvent({
    loadId, orgId: load.orgId, eventType: "verification_complete", actorId: null, actorType: "system",
    description: "Pickup verification completed for load " + (load.referenceNumber ?? ""),
    metadata: { verificationId: verification.id, verifiedAt: verification.verifiedAt?.toISOString(),
      photoCount: verification.photoUrls?.length ?? 0, geoLat: verification.geoLat, geoLng: verification.geoLng },
  });
  if (load.status === "accepted") {
    const result = await transitionStatus(loadId, "in_transit", null, load.orgId, {
      triggeredBy: "pickup_verification_complete", verificationId: verification.id });
    if (!result.success) return { success: false, error: "Status transition failed: " + (result.error ?? "") };
  }
  revalidatePath("/loads/" + loadId);
  return { success: true };
}

