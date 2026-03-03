import { NextResponse } from "next/server";
import { verifyPickupOtp } from "@/app/actions/verification";
import { otpVerifySchema } from "@/lib/validation/schemas";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // Rate limit: 10 attempts per 15 minutes per IP
    const ip = getClientIp(request);
    const rl = rateLimit(`verify-otp:${ip}`, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many verification attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)),
            "X-RateLimit-Remaining": String(rl.remaining),
          },
        }
      );
    }

    const body = await request.json();
    const parsed = otpVerifySchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const msg = Object.values(errors).flat().join("; ") || "Invalid input";
      return NextResponse.json({ success: false, message: msg }, { status: 400 });
    }

    const { loadId, otp } = parsed.data;
    const result = await verifyPickupOtp(loadId, otp);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
