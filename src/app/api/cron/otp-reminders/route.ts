import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { loads, pickupVerifications } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { generatePickupVerification, sendPickupOtp } from "@/lib/verification/pickup-service";

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

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const load of upcomingLoads) {
      // Check if a pickup verification already exists for this load
      const [existingVerification] = await db
        .select({ id: pickupVerifications.id })
        .from(pickupVerifications)
        .where(eq(pickupVerifications.loadId, load.id))
        .limit(1);

      if (existingVerification) {
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
          console.log(`[CRON] No phone for load ${load.referenceNumber}, verification created but OTP not sent`);
          sent++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Load ${load.referenceNumber}: ${msg}`);
      }
    }

    console.log(`[CRON] OTP reminders: ${sent} sent, ${skipped} skipped, ${errors.length} errors`);
    return NextResponse.json({
      success: true,
      loadsChecked: upcomingLoads.length,
      sent,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[CRON] OTP reminders failed:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
