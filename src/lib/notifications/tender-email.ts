import { Resend } from "resend";
import { logger } from "@/lib/logger";

export async function sendTenderNotification(
  carrierEmail: string,
  carrierName: string,
  loadRef: string,
  tenderToken: string
): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    logger.info("TENDER", "RESEND_API_KEY not configured", { carrierEmail });
    return { success: false, error: "Resend not configured" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const tenderLink = `${appUrl}/tender/${tenderToken}`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
  <div style="background:#18181b;color:#ffffff;padding:24px 32px;">
    <h1 style="margin:0;font-size:20px;font-weight:600;">Load Tender</h1>
    <p style="margin:4px 0 0;font-size:14px;color:#a1a1aa;">FreightVerify</p>
  </div>
  <div style="padding:24px 32px;">
    <p style="font-size:14px;color:#3f3f46;">Hi ${carrierName},</p>
    <p style="font-size:14px;color:#3f3f46;">You have been tendered <strong>Load ${loadRef}</strong>. Please review the load details and accept or decline within 48 hours.</p>
    <div style="margin:24px 0;text-align:center;">
      <a href="${tenderLink}" style="display:inline-block;background:#18181b;color:#ffffff;padding:12px 32px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">Review Tender</a>
    </div>
    <p style="font-size:13px;color:#71717a;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="font-size:13px;color:#71717a;word-break:break-all;">${tenderLink}</p>
  </div>
  <div style="background:#f4f4f5;padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#a1a1aa;">FreightVerify - Carrier verification and load management</p>
  </div>
</div>`;

  const resend = new Resend(resendApiKey);

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "FreightVerify <onboarding@resend.dev>",
      to: [carrierEmail],
      subject: `Load Tender - ${loadRef}`,
      html,
    });

    if (error) {
      logger.error("TENDER", "Resend error", { error: String(error) });
      return { success: false, error: error.message };
    }

    logger.info("TENDER", "Tender email sent", { carrierEmail, loadRef });
    return { success: true };
  } catch (err) {
    logger.error("TENDER", "Send failed", { error: String(err) });
    return { success: false, error: "Failed to send tender email" };
  }
}
