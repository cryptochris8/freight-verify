import { db } from "@/lib/db";
import { carriers, carrierDocuments, alerts } from "@/lib/db/schema";
import { eq, and, lte, gte } from "drizzle-orm";
import { addDays } from "date-fns";
import { generateDailyDigest } from "@/lib/notifications/daily-digest";

/**
 * Re-verify all active carriers against FMCSA weekly.
 * TODO: Wire up to Vercel Cron or Inngest.
 */
export async function dailyFmcsaRecheck(orgId: string) {
  const activeCarriers = await db
    .select({ id: carriers.id, dotNumber: carriers.dotNumber, legalName: carriers.legalName })
    .from(carriers)
    .where(and(eq(carriers.orgId, orgId), eq(carriers.status, "verified")));

  console.log(
    "[CRON] dailyFmcsaRecheck: Would re-verify " +
    activeCarriers.length + " active carriers for org " + orgId
  );

  for (const carrier of activeCarriers) {
    console.log(
      "[CRON] Would check FMCSA for carrier: " +
      carrier.legalName + " (DOT# " + carrier.dotNumber + ")"
    );
    // TODO: call FMCSA API and compare status
    // If status changed, create alert via checkFmcsaStatusChange rule
  }
}

/**
 * Check carrier documents expiring within 30 days and create alerts.
 * TODO: Wire up to Vercel Cron or Inngest.
 */
export async function dailyDocExpirationCheck(orgId: string) {
  const now = new Date();
  const thirtyDaysFromNow = addDays(now, 30);

  const expiringDocs = await db
    .select({
      id: carrierDocuments.id,
      carrierId: carrierDocuments.carrierId,
      docType: carrierDocuments.docType,
      expiresAt: carrierDocuments.expiresAt,
    })
    .from(carrierDocuments)
    .where(
      and(
        eq(carrierDocuments.orgId, orgId),
        gte(carrierDocuments.expiresAt, now),
        lte(carrierDocuments.expiresAt, thirtyDaysFromNow)
      )
    );

  console.log(
    "[CRON] dailyDocExpirationCheck: Found " +
    expiringDocs.length + " expiring documents for org " + orgId
  );

  for (const doc of expiringDocs) {
    if (!doc.expiresAt) continue;
    const daysUntil = Math.floor(
      (doc.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const severity = daysUntil <= 7 ? "critical" : daysUntil <= 14 ? "high" : "medium";

    await db.insert(alerts).values({
      orgId,
      carrierId: doc.carrierId,
      alertType: "document_expiration",
      severity: severity as "critical" | "high" | "medium",
      title: "Document Expiring Soon",
      message: doc.docType.replace(/_/g, " ") + " expires in " + daysUntil + " days",
      metadata: {
        documentId: doc.id,
        documentType: doc.docType,
        expiresAt: doc.expiresAt.toISOString(),
        daysUntilExpiry: daysUntil,
      },
    });
  }
}

/**
 * Send daily digest email to org admins.
 * TODO: Wire up to Vercel Cron or Inngest.
 */
export async function dailyDigestSend(orgId: string) {
  console.log("[CRON] dailyDigestSend: Generating digest for org " + orgId);
  const digest = await generateDailyDigest(orgId);
  console.log("[CRON] Digest generated. Subject: " + digest.subject);
  console.log("[CRON] Would send to: " + (digest.to.length > 0 ? digest.to.join(", ") : "no recipients configured"));
  // TODO: send via Resend
}
