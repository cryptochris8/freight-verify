import { NextResponse } from "next/server";
import { generatePickupVerification, sendPickupOtp } from "@/lib/verification/pickup-service";
import { db } from "@/lib/db";
import { pickupVerifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

    if (phoneNumber && result.verificationId) {
      await sendPickupOtp(result.verificationId, phoneNumber);
    } else if (result.verificationId) {
      const [verification] = await db
        .select()
        .from(pickupVerifications)
        .where(eq(pickupVerifications.id, result.verificationId))
        .limit(1);

      if (verification?.driverPhone) {
        await sendPickupOtp(result.verificationId, verification.driverPhone);
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
