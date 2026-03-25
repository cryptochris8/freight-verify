import { NextResponse } from "next/server";
import { generatePickupVerification, sendPickupOtp } from "@/lib/verification/pickup-service";
import { db } from "@/lib/db";
import { pickupVerifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { validateDriverTokenForLoad } from "@/lib/auth/driver-token";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

async function getDriverPhone(verificationId: string): Promise<string | null> {
  const [verification] = await db
    .select({ driverPhone: pickupVerifications.driverPhone })
    .from(pickupVerifications)
    .where(eq(pickupVerifications.id, verificationId))
    .limit(1);
  return verification?.driverPhone ?? null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { loadId } = body;

    if (!loadId) {
      return NextResponse.json({ success: false, error: "loadId is required" }, { status: 400 });
    }

    // Require a valid driver token that matches the requested load
    const load = await validateDriverTokenForLoad(request, loadId);
    if (!load) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 5 attempts per 15 minutes per load
    const ip = getClientIp(request);
    const rl = await rateLimit(`verification:${loadId}:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    const result = await generatePickupVerification(loadId);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // Always use the stored phone number — never accept user-supplied phone
    if (result.verificationId && result.otp) {
      const storedPhone = await getDriverPhone(result.verificationId);
      if (storedPhone) {
        await sendPickupOtp(result.verificationId, storedPhone, result.otp);
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logger.error("VERIFICATION", "POST request failed", { error: String(error) });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
