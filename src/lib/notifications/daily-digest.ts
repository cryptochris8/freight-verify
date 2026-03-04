import { db } from "@/lib/db";
import { alerts, carriers, carrierDocuments, loads, organizations, pickupVerifications } from "@/lib/db/schema";
import { eq, and, gte, lte, count, desc } from "drizzle-orm";
import { subHours, addDays, format } from "date-fns";
import { Resend } from "resend";

export async function generateDailyDigest(orgId: string) {
  const now = new Date();
  const twentyFourHoursAgo = subHours(now, 24);
  const thirtyDaysFromNow = addDays(now, 30);

  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const orgName = org?.name ?? "Unknown Org";

  const newAlerts = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), gte(alerts.createdAt, twentyFourHoursAgo)))
    .orderBy(desc(alerts.createdAt));

  const [unackCount] = await db
    .select({ value: count() })
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), eq(alerts.status, "open")));

  const expiringDocs = await db
    .select({
      id: carrierDocuments.id,
      docType: carrierDocuments.docType,
      fileName: carrierDocuments.fileName,
      expiresAt: carrierDocuments.expiresAt,
      carrierName: carriers.legalName,
    })
    .from(carrierDocuments)
    .leftJoin(carriers, eq(carrierDocuments.carrierId, carriers.id))
    .where(
      and(
        eq(carrierDocuments.orgId, orgId),
        gte(carrierDocuments.expiresAt, now),
        lte(carrierDocuments.expiresAt, thirtyDaysFromNow)
      )
    );

  const staleTenders = await db
    .select()
    .from(loads)
    .where(
      and(
        eq(loads.orgId, orgId),
        eq(loads.status, "tendered"),
        lte(loads.updatedAt, twentyFourHoursAgo)
      )
    );

  const [newLoadsCount] = await db
    .select({ value: count() })
    .from(loads)
    .where(and(eq(loads.orgId, orgId), gte(loads.createdAt, twentyFourHoursAgo)));

  const [completedVerifications] = await db
    .select({ value: count() })
    .from(pickupVerifications)
    .where(
      and(
        eq(pickupVerifications.orgId, orgId),
        eq(pickupVerifications.verificationStatus, "verified"),
        gte(pickupVerifications.verifiedAt, twentyFourHoursAgo)
      )
    );

  const html = generateDigestHtml({
    orgName,
    newAlerts: newAlerts.map((a) => ({
      title: a.title,
      severity: a.severity,
      message: a.message,
      createdAt: a.createdAt,
    })),
    unacknowledgedCount: unackCount?.value ?? 0,
    expiringDocs: expiringDocs.map((d) => ({
      docType: d.docType,
      carrierName: d.carrierName ?? "Unknown",
      expiresAt: d.expiresAt,
    })),
    staleTenders: staleTenders.map((l) => ({
      referenceNumber: l.referenceNumber ?? l.id,
      updatedAt: l.updatedAt,
    })),
    newLoadsCount: newLoadsCount?.value ?? 0,
    completedVerificationsCount: completedVerifications?.value ?? 0,
  });

  const subject = "FreightVerify Daily Digest - " + format(now, "MMM d, yyyy");

  return {
    to: [] as string[],
    subject,
    html,
  };
}

export async function sendDailyDigest(orgId: string, recipientEmails: string[]) {
  const digest = await generateDailyDigest(orgId);

  if (recipientEmails.length === 0) {
    console.log("[DAILY DIGEST] No recipients configured for org " + orgId);
    return { success: false, error: "No recipients" };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.log("[DAILY DIGEST] RESEND_API_KEY not configured. Subject: " + digest.subject);
    return { success: false, error: "Resend not configured" };
  }

  const resend = new Resend(resendApiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: "FreightVerify <onboarding@resend.dev>",
      to: recipientEmails,
      subject: digest.subject,
      html: digest.html,
    });

    if (error) {
      console.error("[DAILY DIGEST] Resend error:", error);
      return { success: false, error: error.message };
    }

    console.log("[DAILY DIGEST] Sent to " + recipientEmails.join(", ") + ", id: " + data?.id);
    return { success: true, emailId: data?.id };
  } catch (err) {
    console.error("[DAILY DIGEST] Send failed:", err);
    return { success: false, error: "Failed to send email" };
  }
}

interface DigestData {
  orgName: string;
  newAlerts: { title: string; severity: string; message: string; createdAt: Date | null }[];
  unacknowledgedCount: number;
  expiringDocs: { docType: string; carrierName: string; expiresAt: Date | null }[];
  staleTenders: { referenceNumber: string; updatedAt: Date | null }[];
  newLoadsCount: number;
  completedVerificationsCount: number;
}

function generateDigestHtml(data: DigestData): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const severityColors: Record<string, string> = {
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#ca8a04",
    low: "#2563eb",
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;margin-top:24px;margin-bottom:24px;">
    <div style="background:#18181b;color:#ffffff;padding:24px 32px;">
      <h1 style="margin:0;font-size:20px;font-weight:600;">FreightVerify Daily Digest</h1>
      <p style="margin:4px 0 0;font-size:14px;color:#a1a1aa;">${data.orgName}</p>
    </div>

    <div style="padding:24px 32px;">
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;background:#f4f4f5;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#18181b;">${data.newLoadsCount}</div>
          <div style="font-size:12px;color:#71717a;margin-top:4px;">New Loads</div>
        </div>
        <div style="flex:1;background:#f4f4f5;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#18181b;">${data.completedVerificationsCount}</div>
          <div style="font-size:12px;color:#71717a;margin-top:4px;">Verifications</div>
        </div>
        <div style="flex:1;background:#f4f4f5;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:${data.newAlerts.length > 0 ? "#dc2626" : "#18181b"};">${data.newAlerts.length}</div>
          <div style="font-size:12px;color:#71717a;margin-top:4px;">New Alerts</div>
        </div>
      </div>

      ${data.newAlerts.length > 0 ? `
      <h2 style="font-size:16px;font-weight:600;margin:24px 0 12px;border-bottom:1px solid #e4e4e7;padding-bottom:8px;">New Alerts (Last 24h)</h2>
      <table style="width:100%;border-collapse:collapse;">
        ${data.newAlerts.slice(0, 10).map((alert) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;">
            <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#fff;background:${severityColors[alert.severity] ?? "#71717a"};text-transform:uppercase;">${alert.severity}</span>
            <span style="font-size:14px;font-weight:500;margin-left:8px;">${alert.title}</span>
            <div style="font-size:13px;color:#71717a;margin-top:2px;">${alert.message}</div>
          </td>
        </tr>`).join("")}
      </table>
      ` : `<p style="color:#71717a;font-size:14px;">No new alerts in the last 24 hours.</p>`}

      ${data.unacknowledgedCount > 0 ? `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:16px 0;">
        <strong style="color:#dc2626;">${data.unacknowledgedCount} unacknowledged alert${data.unacknowledgedCount > 1 ? "s" : ""}</strong>
        <span style="color:#71717a;font-size:13px;"> require attention.</span>
        <a href="${appUrl}/alerts" style="display:block;margin-top:8px;color:#dc2626;font-size:13px;">View alerts &rarr;</a>
      </div>
      ` : ""}

      ${data.expiringDocs.length > 0 ? `
      <h2 style="font-size:16px;font-weight:600;margin:24px 0 12px;border-bottom:1px solid #e4e4e7;padding-bottom:8px;">Documents Expiring Within 30 Days</h2>
      <ul style="padding-left:20px;margin:0;">
        ${data.expiringDocs.map((doc) => {
          const expDate = doc.expiresAt ? format(doc.expiresAt, "MMM d, yyyy") : "unknown";
          return `<li style="font-size:14px;color:#3f3f46;margin-bottom:6px;">${doc.docType.replace(/_/g, " ")} - ${doc.carrierName} (expires ${expDate})</li>`;
        }).join("")}
      </ul>
      ` : ""}

      ${data.staleTenders.length > 0 ? `
      <h2 style="font-size:16px;font-weight:600;margin:24px 0 12px;border-bottom:1px solid #e4e4e7;padding-bottom:8px;">Loads Needing Attention</h2>
      <ul style="padding-left:20px;margin:0;">
        ${data.staleTenders.map((load) => `<li style="font-size:14px;color:#3f3f46;margin-bottom:6px;">Load ${load.referenceNumber} - tendered 24h+ without response</li>`).join("")}
      </ul>
      ` : ""}

      <div style="margin-top:32px;text-align:center;">
        <a href="${appUrl}" style="display:inline-block;background:#18181b;color:#ffffff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;">Open Dashboard</a>
      </div>
    </div>

    <div style="background:#f4f4f5;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#a1a1aa;">FreightVerify - Carrier verification and load management</p>
    </div>
  </div>
</body>
</html>`;
}
