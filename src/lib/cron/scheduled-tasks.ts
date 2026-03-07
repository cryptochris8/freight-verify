import { db } from "@/lib/db";
import { carriers, carrierDocuments, alerts } from "@/lib/db/schema";
import { eq, and, lte, gte } from "drizzle-orm";
import { addDays } from "date-fns";
import { sendDailyDigest } from "@/lib/notifications/daily-digest";
import { lookupCarrier } from "@/lib/fmcsa/client";
import { checkFmcsaStatusChange } from "@/lib/alerts/rules";

/**
 * Re-verify all active carriers against FMCSA weekly.
 * TODO: Wire up to Vercel Cron or Inngest.
 */
export async function dailyFmcsaRecheck(orgId: string) {
  const activeCarriers = await db
    .select({ id: carriers.id, dotNumber: carriers.dotNumber, legalName: carriers.legalName, fmcsaSnapshot: carriers.fmcsaSnapshot })
    .from(carriers)
    .where(and(eq(carriers.orgId, orgId), eq(carriers.status, "verified")));

  console.log(
    "[CRON] dailyFmcsaRecheck: Re-verifying " +
    activeCarriers.length + " active carriers for org " + orgId
  );

  for (const carrier of activeCarriers) {
    try {
      const result = await lookupCarrier(carrier.dotNumber);
      if (!result.success || !result.data) {
        console.log("[CRON] FMCSA lookup failed for " + carrier.dotNumber + ": " + (result.error ?? "unknown"));
        continue;
      }

      const fmcsaSnapshot = carrier.fmcsaSnapshot as Record<string, unknown> | null;
      const previousStatus = (fmcsaSnapshot?.operatingStatus as string) ?? "";
      const currentStatus = result.data.operatingStatus ?? "";

      // Update the carrier's FMCSA snapshot and last check timestamp
      await db.update(carriers).set({
        fmcsaSnapshot: result.data as unknown as Record<string, unknown>,
        fmcsaLastCheck: new Date(),
        updatedAt: new Date(),
      }).where(eq(carriers.id, carrier.id));

      if (previousStatus && currentStatus && previousStatus !== currentStatus) {
        const alertResult = checkFmcsaStatusChange({
          carrierId: carrier.id,
          dotNumber: carrier.dotNumber,
          previousStatus,
          currentStatus,
        });
        if (alertResult.triggered) {
          await db.insert(alerts).values({
            orgId,
            carrierId: carrier.id,
            alertType: alertResult.alertType,
            severity: alertResult.severity,
            title: alertResult.title,
            message: alertResult.message,
            metadata: alertResult.metadata,
          });
          console.log("[CRON] FMCSA status alert created for carrier " + carrier.dotNumber);
        }
      }
    } catch (err) {
      console.error("[CRON] Error checking carrier " + carrier.dotNumber + ":", err);
    }
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

    // Check if an open alert already exists for this document
    const [existingAlert] = await db.select({ id: alerts.id }).from(alerts)
      .where(and(
        eq(alerts.orgId, orgId),
        eq(alerts.carrierId, doc.carrierId),
        eq(alerts.alertType, "document_expiration"),
        eq(alerts.status, "open"),
      )).limit(1);
    if (existingAlert) continue;

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

export async function dailyDigestSend(orgId: string, recipientEmails: string[]) {
  console.log("[CRON] dailyDigestSend: Generating and sending digest for org " + orgId);
  const result = await sendDailyDigest(orgId, recipientEmails);
  if (result.success) {
    console.log("[CRON] Digest sent successfully, id: " + result.emailId);
  } else {
    console.log("[CRON] Digest send failed: " + result.error);
  }
  return result;
}
