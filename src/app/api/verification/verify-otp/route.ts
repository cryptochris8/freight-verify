import { NextResponse } from "next/server";
import { verifyPickupOtp } from "@/app/actions/verification";
import { otpVerifySchema } from "@/lib/validation/schemas";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { validateDriverTokenForLoad } from "@/lib/auth/driver-token";

export async function POST(request: Request) {
  try {
    // Rate limit: 10 attempts per 15 minutes per IP + per load
    const ip = getClientIp(request);
    const rl = await rateLimit(`verify-otp:${ip}`, 10, 15 * 60 * 1000);
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

    // Require a valid driver token that matches the load
    const load = await validateDriverTokenForLoad(request, loadId);
    if (!load) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Also rate limit per loadId to prevent distributed brute-force
    const loadRl = await rateLimit(`verify-otp:load:${loadId}`, 15, 15 * 60 * 1000);
    if (!loadRl.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many verification attempts for this load." },
        { status: 429 }
      );
    }

    const result = await verifyPickupOtp(loadId, otp);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    logger.error("VERIFY_OTP", "OTP verification failed", { error: String(error) });
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
