import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { dailyFmcsaRecheck, dailyDocExpirationCheck, dailyDigestSend } from "@/lib/cron/scheduled-tasks";
import { cleanupRateLimitEntries } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { orgId: string; fmcsa: string; docs: string; digest: string }[] = [];

  try {
    const allOrgs = await db.select({
      id: organizations.id,
      digestEnabled: organizations.digestEnabled,
      digestRecipientEmails: organizations.digestRecipientEmails,
    }).from(organizations);

    for (const org of allOrgs) {
      const orgResult = { orgId: org.id, fmcsa: "ok", docs: "ok", digest: "skipped" };
      try {
        await dailyFmcsaRecheck(org.id);
      } catch (err) {
        logger.error("CRON", "FMCSA recheck failed", { orgId: org.id, error: String(err) });
        orgResult.fmcsa = "error";
      }
      try {
        await dailyDocExpirationCheck(org.id);
      } catch (err) {
        logger.error("CRON", "Doc expiration check failed", { orgId: org.id, error: String(err) });
        orgResult.docs = "error";
      }
      // Send daily digest if enabled and recipients are configured
      if (org.digestEnabled && org.digestRecipientEmails && org.digestRecipientEmails.length > 0) {
        try {
          const digestResult = await dailyDigestSend(org.id, org.digestRecipientEmails);
          orgResult.digest = digestResult.success ? "sent" : "error";
        } catch (err) {
          logger.error("CRON", "Digest send failed", { orgId: org.id, error: String(err) });
          orgResult.digest = "error";
        }
      }
      results.push(orgResult);
    }

    // Cleanup stale rate limit entries
    try {
      const cleaned = await cleanupRateLimitEntries();
      logger.info("CRON", "Rate limit entries cleaned", { entriesRemoved: cleaned });
    } catch (err) {
      logger.error("CRON", "Rate limit cleanup failed", { error: String(err) });
    }

    logger.info("CRON", "Daily tasks completed", { orgsProcessed: allOrgs.length });
    return NextResponse.json({ success: true, orgsProcessed: allOrgs.length, results });
  } catch (error) {
    logger.error("CRON", "Daily cron failed", { error: String(error) });
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
