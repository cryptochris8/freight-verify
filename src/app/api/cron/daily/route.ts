import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { dailyFmcsaRecheck, dailyDocExpirationCheck, dailyDigestSend } from "@/lib/cron/scheduled-tasks";

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
        console.error(`[CRON] FMCSA recheck failed for org ${org.id}:`, err);
        orgResult.fmcsa = "error";
      }
      try {
        await dailyDocExpirationCheck(org.id);
      } catch (err) {
        console.error(`[CRON] Doc expiration check failed for org ${org.id}:`, err);
        orgResult.docs = "error";
      }
      // Send daily digest if enabled and recipients are configured
      if (org.digestEnabled && org.digestRecipientEmails && org.digestRecipientEmails.length > 0) {
        try {
          const digestResult = await dailyDigestSend(org.id, org.digestRecipientEmails);
          orgResult.digest = digestResult.success ? "sent" : "error";
        } catch (err) {
          console.error(`[CRON] Digest send failed for org ${org.id}:`, err);
          orgResult.digest = "error";
        }
      }
      results.push(orgResult);
    }

    console.log(`[CRON] Daily tasks completed for ${allOrgs.length} organizations`);
    return NextResponse.json({ success: true, orgsProcessed: allOrgs.length, results });
  } catch (error) {
    console.error("[CRON] Daily cron failed:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
