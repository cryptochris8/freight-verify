import { db } from "@/lib/db";
import { loads, carriers, pickupVerifications, loadEvents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateOtp, hashOtp } from "./otp";
import { computeEventHash } from "@/lib/events/hash-chain";

export interface PickupVerificationResult {
  success: boolean;
  error?: string;
  otp?: string;
  verificationId?: string;
}

/**
 * Generates a pickup verification for a load:
 * - Validates load is in "accepted" status
 * - Generates and hashes a 6-digit OTP
 * - Creates a pickup_verification record
 * - Creates a hash-chained load_event
 * - Returns the plain OTP (to be sent via SMS) and the verification record ID
 */
export async function generatePickupVerification(
  loadId: string
): Promise<PickupVerificationResult> {
  // Fetch the load
  const [load] = await db
    .select()
    .from(loads)
    .where(eq(loads.id, loadId))
    .limit(1);

  if (!load) {
    return { success: false, error: "Load not found" };
  }

  if (load.status !== "accepted") {
    return {
      success: false,
      error: `Load must be in 'accepted' status to generate pickup verification. Current status: '${load.status}'`,
    };
  }

  // Get carrier info for driver details
  let carrier = null;
  if (load.carrierId) {
    const [c] = await db
      .select()
      .from(carriers)
      .where(eq(carriers.id, load.carrierId))
      .limit(1);
    carrier = c ?? null;
  }

  // Extract driver info from load metadata if available
  const metadata = (load.metadata ?? {}) as Record<string, unknown>;
  const driverName = (metadata.driverName as string) ?? null;
  const driverPhone = (metadata.driverPhone as string) ?? carrier?.phone ?? null;
  const truckNumber = (metadata.truckNumber as string) ?? null;
  const trailerNumber = (metadata.trailerNumber as string) ?? null;

  // Generate OTP
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const otpExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now

  // Create pickup verification record
  const [verification] = await db
    .insert(pickupVerifications)
    .values({
      loadId: load.id,
      orgId: load.orgId,
      otpHash,
      otpExpiresAt,
      otpAttempts: 0,
      driverName,
      driverPhone,
      truckNumber,
      trailerNumber,
      verificationStatus: "pending",
    })
    .returning();

  // Create hash-chained load event
  const [lastEvent] = await db
    .select()
    .from(loadEvents)
    .where(eq(loadEvents.loadId, loadId))
    .orderBy(desc(loadEvents.id))
    .limit(1);

  const prevHash = lastEvent?.eventHash ?? null;
  const now = new Date();

  const eventData = {
    loadId,
    eventType: "pickup_verification_created",
    actorId: null,
    actorType: "system" as const,
    description: `Pickup verification created for load ${load.referenceNumber}`,
    metadata: {
      verificationId: verification.id,
      otpExpiresAt: otpExpiresAt.toISOString(),
    },
    geoLat: null,
    geoLng: null,
    createdAt: now,
  };

  const eventHash = computeEventHash(eventData, prevHash);

  await db.insert(loadEvents).values({
    loadId,
    orgId: load.orgId,
    eventType: eventData.eventType,
    actorId: eventData.actorId,
    actorType: eventData.actorType,
    description: eventData.description,
    metadata: eventData.metadata,
    prevHash,
    eventHash,
    createdAt: now,
  });

  return {
    success: true,
    otp,
    verificationId: verification.id,
  };
}

/**
 * Sends the pickup OTP to the driver's phone number.
 * Currently a placeholder that logs the SMS message.
 * TODO: Integrate with Twilio SDK for actual SMS delivery.
 */
export async function sendPickupOtp(
  verificationId: string,
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  // Fetch verification and associated load
  const [verification] = await db
    .select()
    .from(pickupVerifications)
    .where(eq(pickupVerifications.id, verificationId))
    .limit(1);

  if (!verification) {
    return { success: false, error: "Verification record not found" };
  }

  const [load] = await db
    .select()
    .from(loads)
    .where(eq(loads.id, verification.loadId))
    .limit(1);

  if (!load) {
    return { success: false, error: "Load not found" };
  }

  // TODO: Integrate with Twilio SMS API
  // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await twilio.messages.create({
  //   body: `Your pickup code for Load #${load.referenceNumber} at ${load.originName} is: ${otp}. Show this to dock staff.`,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: phoneNumber,
  // });

  console.log(
    `[SMS PLACEHOLDER] To: ${phoneNumber}, Message: "Your pickup code for Load #${load.referenceNumber} at ${load.originName} is: [OTP]. Show this to dock staff."`
  );

  // Update driver phone on verification record
  await db
    .update(pickupVerifications)
    .set({ driverPhone: phoneNumber, updatedAt: new Date() })
    .where(eq(pickupVerifications.id, verificationId));

  // Create hash-chained load event for OTP sent
  const [lastEvent] = await db
    .select()
    .from(loadEvents)
    .where(eq(loadEvents.loadId, verification.loadId))
    .orderBy(desc(loadEvents.id))
    .limit(1);

  const prevHash = lastEvent?.eventHash ?? null;
  const now = new Date();

  const eventData = {
    loadId: verification.loadId,
    eventType: "otp_sent",
    actorId: null,
    actorType: "system" as const,
    description: `OTP sent to driver at ${phoneNumber.slice(0, 3)}***${phoneNumber.slice(-4)}`,
    metadata: {
      verificationId,
      phoneLastFour: phoneNumber.slice(-4),
    },
    geoLat: null,
    geoLng: null,
    createdAt: now,
  };

  const eventHash = computeEventHash(eventData, prevHash);

  await db.insert(loadEvents).values({
    loadId: verification.loadId,
    orgId: load.orgId,
    eventType: eventData.eventType,
    actorId: eventData.actorId,
    actorType: eventData.actorType,
    description: eventData.description,
    metadata: eventData.metadata,
    prevHash,
    eventHash,
    createdAt: now,
  });

  return { success: true };
}

/**
 * Schedules OTP send for 2 hours before pickup_date.
 * Currently generates and sends immediately.
 * TODO: Integrate with a job scheduler (e.g., BullMQ, Inngest, or cron)
 * to schedule the SMS for 2 hours before pickup_date.
 */
export async function scheduleOtpSend(
  loadId: string
): Promise<{ success: boolean; error?: string; otp?: string; verificationId?: string }> {
  const [load] = await db
    .select()
    .from(loads)
    .where(eq(loads.id, loadId))
    .limit(1);

  if (!load) {
    return { success: false, error: "Load not found" };
  }

  // TODO: Calculate 2 hours before pickup_date and schedule via job queue
  // const scheduledTime = new Date(load.pickupDate.getTime() - 2 * 60 * 60 * 1000);
  // await jobQueue.schedule(scheduledTime, 'send-pickup-otp', { loadId });

  // For now: generate and "send" immediately
  const result = await generatePickupVerification(loadId);
  if (!result.success || !result.verificationId) {
    return { success: false, error: result.error };
  }

  // Get driver phone from verification record or carrier
  const [verification] = await db
    .select()
    .from(pickupVerifications)
    .where(eq(pickupVerifications.id, result.verificationId))
    .limit(1);

  const phone = verification?.driverPhone;
  if (phone) {
    await sendPickupOtp(result.verificationId, phone);
  } else {
    console.log(
      `[SMS PLACEHOLDER] No phone number available for verification ${result.verificationId}. OTP not sent.`
    );
  }

  return {
    success: true,
    otp: result.otp,
    verificationId: result.verificationId,
  };
}
