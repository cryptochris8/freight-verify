import { db } from "@/lib/db";
import { carriers, carrierDocuments, alerts } from "@/lib/db/schema";
import { eq, and, lte, gte } from "drizzle-orm";
import { addDays } from "date-fns";
import { sendDailyDigest } from "@/lib/notifications/daily-digest";
import { lookupCarrier } from "@/lib/fmcsa/client";
import { checkFmcsaStatusChange } from "@/lib/alerts/rules";
import { logger } from "@/lib/logger";

/**
 * Re-verify all active carriers against FMCSA.
 * Called by /api/cron/daily (Vercel Cron).
 */
export async function dailyFmcsaRecheck(orgId: string) {
  const activeCarriers = await db
    .select({ id: carriers.id, dotNumber: carriers.dotNumber, legalName: carriers.legalName, fmcsaSnapshot: carriers.fmcsaSnapshot, fmcsaLastCheck: carriers.fmcsaLastCheck })
    .from(carriers)
    .where(and(eq(carriers.orgId, orgId), eq(carriers.status, "verified")));

  logger.info("CRON", "dailyFmcsaRecheck: Re-verifying active carriers", { count: activeCarriers.length, orgId });

  for (const carrier of activeCarriers) {
    try {
      const result = await lookupCarrier(carrier.dotNumber);
      if (!result.success || !result.data) {
        logger.info("CRON", "FMCSA lookup failed", { dotNumber: carrier.dotNumber, error: result.error ?? "unknown" });
        continue;
      }

      const fmcsaSnapshot = carrier.fmcsaSnapshot as Record<string, unknown> | null;
      const previousStatus = (fmcsaSnapshot?.operatingStatus as string) ?? "";
      const currentStatus = result.data.operatingStatus ?? "";

      // Update the carrier's FMCSA snapshot and last check timestamp
      await db.update(carriers).set({
        fmcsaSnapshot: JSON.parse(JSON.stringify(result.data)) as Record<string, unknown>,
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
          logger.info("CRON", "FMCSA status alert created", { dotNumber: carrier.dotNumber });
        }
      }
    } catch (err) {
      logger.error("CRON", "Error checking carrier", { dotNumber: carrier.dotNumber, error: String(err) });
    }
  }
}

/**
 * Check carrier documents expiring within 30 days and create alerts.
 * Called by /api/cron/daily (Vercel Cron).
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

  logger.info("CRON", "dailyDocExpirationCheck: Found expiring documents", { count: expiringDocs.length, orgId });

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
  logger.info("CRON", "dailyDigestSend: Generating and sending digest", { orgId });
  const result = await sendDailyDigest(orgId, recipientEmails);
  if (result.success) {
    logger.info("CRON", "Digest sent successfully", { emailId: result.emailId });
  } else {
    logger.warn("CRON", "Digest send failed", { error: result.error });
  }
  return result;
}
