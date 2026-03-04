import { NextResponse } from "next/server";
import { getVerificationStatus } from "@/app/actions/verification";
import { Resend } from "resend";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    const { loadId } = await params;
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
    console.error("Receipt fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    const { loadId } = await params;
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const status = await getVerificationStatus(loadId);
    if (!status.exists) {
      return NextResponse.json({ error: "No verification found" }, { status: 404 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.log("[RECEIPT EMAIL] RESEND_API_KEY not configured. Would send to: " + email);
      return NextResponse.json({ success: true, message: "Receipt logged (email not configured)" });
    }

    const resend = new Resend(resendApiKey);

    const verifiedAt = status.verification.verifiedAt
      ? new Date(status.verification.verifiedAt).toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        })
      : "N/A";

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;">
  <h2 style="color:#18181b;">Pickup Verification Receipt</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:8px 0;color:#71717a;width:40%;">Load Reference</td><td style="padding:8px 0;font-weight:600;">${status.load?.referenceNumber ?? "N/A"}</td></tr>
    <tr><td style="padding:8px 0;color:#71717a;">Carrier</td><td style="padding:8px 0;font-weight:600;">${status.carrierName ?? "N/A"}</td></tr>
    <tr><td style="padding:8px 0;color:#71717a;">Driver</td><td style="padding:8px 0;font-weight:600;">${status.verification.driverName ?? "N/A"}</td></tr>
    <tr><td style="padding:8px 0;color:#71717a;">Verified At</td><td style="padding:8px 0;font-weight:600;">${verifiedAt}</td></tr>
    <tr><td style="padding:8px 0;color:#71717a;">GPS Location</td><td style="padding:8px 0;font-weight:600;">${status.verification.geoLat ?? "N/A"}, ${status.verification.geoLng ?? "N/A"}</td></tr>
    <tr><td style="padding:8px 0;color:#71717a;">Photos</td><td style="padding:8px 0;font-weight:600;">${status.verification.photoUrls?.length ?? 0} captured</td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0;">
  <p style="font-size:12px;color:#a1a1aa;">This is an automated receipt from FreightVerify.</p>
</div>`;

    const { error } = await resend.emails.send({
      from: "FreightVerify <onboarding@resend.dev>",
      to: [email],
      subject: `Verification Receipt - Load ${status.load?.referenceNumber ?? loadId}`,
      html,
    });

    if (error) {
      console.error("[RECEIPT EMAIL] Resend error:", error);
      return NextResponse.json({ error: "Failed to send receipt email" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Receipt email error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
