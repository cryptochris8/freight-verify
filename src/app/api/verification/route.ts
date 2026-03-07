import { NextResponse } from "next/server";
import { generatePickupVerification, sendPickupOtp } from "@/lib/verification/pickup-service";
import { db } from "@/lib/db";
import { pickupVerifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
    const { loadId, phoneNumber } = body;

    if (!loadId) {
      return NextResponse.json({ success: false, error: "loadId is required" }, { status: 400 });
    }

    const result = await generatePickupVerification(loadId);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    if (result.verificationId && result.otp) {
      const targetPhone = phoneNumber || await getDriverPhone(result.verificationId);
      if (targetPhone) {
        await sendPickupOtp(result.verificationId, targetPhone, result.otp);
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
