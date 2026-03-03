import { db } from "@/lib/db";
import { alerts, carriers, carrierDocuments, loads, organizations } from "@/lib/db/schema";
import { eq, and, gte, lte, count, desc } from "drizzle-orm";
import { subHours, subDays, addDays, format } from "date-fns";

export async function generateDailyDigest(orgId: string) {
  const now = new Date();
  const twentyFourHoursAgo = subHours(now, 24);
  const thirtyDaysFromNow = addDays(now, 30);

  // Org info
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const orgName = org?.name ?? "Unknown Org";

  // New alerts (last 24h)
  const newAlerts = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), gte(alerts.createdAt, twentyFourHoursAgo)))
    .orderBy(desc(alerts.createdAt));

  // Unacknowledged alerts
  const [unackCount] = await db
    .select({ value: count() })
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), eq(alerts.status, "open")));

  // Expiring docs (within 30 days)
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

  // Loads needing attention (tendered 24h+ without response)
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

  // Generate email HTML
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
  });

  // Log the digest (TODO: integrate with Resend)
  console.log(
    "[DAILY DIGEST] Org: " + orgName +
    ", New Alerts: " + newAlerts.length +
    ", Unacknowledged: " + (unackCount?.value ?? 0) +
    ", Expiring Docs: " + expiringDocs.length
  );

  return {
    to: [], // TODO: fetch org admin emails
    subject: "FreightVerify Daily Digest - " + format(now, "MMM d, yyyy"),
    html,
  };
}

interface DigestData {
  orgName: string;
  newAlerts: { title: string; severity: string; message: string; createdAt: Date | null }[];
  unacknowledgedCount: number;
  expiringDocs: { docType: string; carrierName: string; expiresAt: Date | null }[];
  staleTenders: { referenceNumber: string; updatedAt: Date | null }[];
}

function generateDigestHtml(data: DigestData): string {
  const sections: string[] = [];

  sections.push("<h1>FreightVerify Daily Digest</h1>");
  sections.push("<p>Organization: " + data.orgName + "</p>");
  sections.push("<hr />");

  // New alerts section
  sections.push("<h2>New Alerts (Last 24h): " + data.newAlerts.length + "</h2>");
  if (data.newAlerts.length > 0) {
    sections.push("<ul>");
    for (const alert of data.newAlerts) {
      sections.push(
        "<li><strong>[" + alert.severity.toUpperCase() + "]</strong> " +
        alert.title + " - " + alert.message + "</li>"
      );
    }
    sections.push("</ul>");
  } else {
    sections.push("<p>No new alerts in the last 24 hours.</p>");
  }

  // Unacknowledged
  sections.push("<h2>Unacknowledged Alerts: " + data.unacknowledgedCount + "</h2>");

  // Expiring docs
  sections.push("<h2>Documents Expiring Within 30 Days: " + data.expiringDocs.length + "</h2>");
  if (data.expiringDocs.length > 0) {
    sections.push("<ul>");
    for (const doc of data.expiringDocs) {
      const expDate = doc.expiresAt ? format(doc.expiresAt, "MMM d, yyyy") : "unknown";
      sections.push(
        "<li>" + doc.docType.replace(/_/g, " ") + " - " +
        doc.carrierName + " (expires " + expDate + ")</li>"
      );
    }
    sections.push("</ul>");
  }

  // Stale tenders
  sections.push("<h2>Loads Needing Attention: " + data.staleTenders.length + "</h2>");
  if (data.staleTenders.length > 0) {
    sections.push("<ul>");
    for (const load of data.staleTenders) {
      sections.push("<li>Load " + load.referenceNumber + " - tendered 24h+ without response</li>");
    }
    sections.push("</ul>");
  }

  return sections.join("\n");
}
