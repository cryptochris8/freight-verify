import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { loads, pickupVerifications } from "@/lib/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { generatePickupVerification, sendPickupOtp } from "@/lib/verification/pickup-service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    // Find loads with status 'accepted' and pickupDate within next 2-3 hours
    const upcomingLoads = await db
      .select({
        id: loads.id,
        referenceNumber: loads.referenceNumber,
        pickupDate: loads.pickupDate,
      })
      .from(loads)
      .where(
        and(
          eq(loads.status, "accepted"),
          gte(loads.pickupDate, now),
          lte(loads.pickupDate, threeHoursFromNow)
        )
      );

    if (upcomingLoads.length === 0) {
      return NextResponse.json({ success: true, loadsChecked: 0, sent: 0, skipped: 0 });
    }

    // Batch-fetch all existing verifications for upcoming loads in ONE query
    // instead of one query per load (N+1 → 1)
    const loadIds = upcomingLoads.map((l) => l.id);
    const existingVerifications = await db
      .select({ loadId: pickupVerifications.loadId })
      .from(pickupVerifications)
      .where(inArray(pickupVerifications.loadId, loadIds));
    const loadsWithVerification = new Set(existingVerifications.map((v) => v.loadId));

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const load of upcomingLoads) {
      if (loadsWithVerification.has(load.id)) {
        skipped++;
        continue;
      }

      try {
        const result = await generatePickupVerification(load.id);
        if (!result.success || !result.verificationId) {
          errors.push(`Load ${load.referenceNumber}: ${result.error}`);
          continue;
        }

        // Look up driver phone from the newly created verification
        const [verification] = await db
          .select({ driverPhone: pickupVerifications.driverPhone })
          .from(pickupVerifications)
          .where(eq(pickupVerifications.id, result.verificationId))
          .limit(1);

        if (verification?.driverPhone && result.otp) {
          await sendPickupOtp(result.verificationId, verification.driverPhone, result.otp);
          sent++;
        } else {
          logger.info("CRON", "No phone for load, verification created but OTP not sent", { loadRef: load.referenceNumber });
          sent++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Load ${load.referenceNumber}: ${msg}`);
      }
    }

    logger.info("CRON", "OTP reminders completed", { sent, skipped, errors: errors.length });
    return NextResponse.json({
      success: true,
      loadsChecked: upcomingLoads.length,
      sent,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error("CRON", "OTP reminders failed", { error: String(error) });
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
