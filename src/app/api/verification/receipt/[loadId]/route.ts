import { NextResponse } from "next/server";
import { getVerificationStatus } from "@/app/actions/verification";
import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { validateDriverTokenForLoad } from "@/lib/auth/driver-token";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/utils/html-encode";
import { z } from "zod";

const receiptEmailSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    const { loadId } = await params;

    // Require a valid driver token that matches the load
    const load = await validateDriverTokenForLoad(request, loadId);
    if (!load) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = await getVerificationStatus(loadId);

    if (!status.exists) {
      return NextResponse.json({ error: "No verification found" }, { status: 404 });
    }

    return NextResponse.json({
      loadReference: status.load?.referenceNumber,
      carrierName: status.carrierName,
      driverName: status.verification.driverName,
      verificationStatus: status.verification.verificationStatus,
      verifiedAt: status.verification.verifiedAt,
      geoLat: status.verification.geoLat,
      geoLng: status.verification.geoLng,
      geoTimestamp: status.verification.geoTimestamp,
      photoUrls: status.verification.photoUrls,
      events: status.events,
    });
  } catch (error) {
    logger.error("RECEIPT", "Fetch failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    const { loadId } = await params;

    // Require a valid driver token that matches the load
    const load = await validateDriverTokenForLoad(request, loadId);
    if (!load) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 5 emails per hour per load
    const ip = getClientIp(request);
    const rl = await rateLimit(`receipt-email:${loadId}:${ip}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many receipt email requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();

    // Validate email format with Zod
    const parsed = receiptEmailSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors.email?.join("; ") || "Invalid email";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { email } = parsed.data;

    const status = await getVerificationStatus(loadId);
    if (!status.exists) {
      return NextResponse.json({ error: "No verification found" }, { status: 404 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      logger.info("RECEIPT_EMAIL", "RESEND_API_KEY not configured, email not sent", { to: email });
      return NextResponse.json({ success: true, message: "Receipt logged (email not configured)" });
    }

    const resend = new Resend(resendApiKey);

    const verifiedAt = status.verification.verifiedAt
      ? new Date(status.verification.verifiedAt).toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        })
      : "N/A";

    // HTML-encode all interpolated values to prevent XSS
    const safeRefNum = escapeHtml(status.load?.referenceNumber ?? "N/A");
    const safeCarrier = escapeHtml(status.carrierName ?? "N/A");
    const safeDriver = escapeHtml(status.verification.driverName ?? "N/A");
    const safeVerifiedAt = escapeHtml(verifiedAt);
    const safeGeoLat = escapeHtml(status.verification.geoLat ?? "N/A");
    const safeGeoLng = escapeHtml(status.verification.geoLng ?? "N/A");
    const photoCount = status.verification.photoUrls?.length ?? 0;

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;">
  <h2 style="color:#18181b;">Pickup Verification Receipt</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:8px 0;color:#71717a;width:40%;">Load Reference</td><td style="padding:8px 0;font-weight:600;">${safeRefNum}</td></tr>
    <tr><td style="padding:8px 0;color:#71717a;">Carrier</td><td style="padding:8px 0;font-weight:600;">${safeCarrier}</td></tr>
    <tr><td style="padding:8px 0;color:#71717a;">Driver</td><td style="padding:8px 0;font-weight:600;">${safeDriver}</td></tr>
    <tr><td style="padding:8px 0;color:#71717a;">Verified At</td><td style="padding:8px 0;font-weight:600;">${safeVerifiedAt}</td></tr>
    <tr><td style="padding:8px 0;color:#71717a;">GPS Location</td><td style="padding:8px 0;font-weight:600;">${safeGeoLat}, ${safeGeoLng}</td></tr>
    <tr><td style="padding:8px 0;color:#71717a;">Photos</td><td style="padding:8px 0;font-weight:600;">${photoCount} captured</td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0;">
  <p style="font-size:12px;color:#a1a1aa;">This is an automated receipt from FreightVerify.</p>
</div>`;

    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "FreightVerify <onboarding@resend.dev>",
      to: [email],
      subject: `Verification Receipt - Load ${safeRefNum}`,
      html,
    });

    if (error) {
      logger.error("RECEIPT_EMAIL", "Resend send failed", { error: String(error) });
      return NextResponse.json({ error: "Failed to send receipt email" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("RECEIPT_EMAIL", "POST request failed", { error: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
