import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { dailyFmcsaRecheck, dailyDocExpirationCheck } from "@/lib/cron/scheduled-tasks";

export const dynamic = "force-dynamic";

export async function GET() {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { orgId: string; fmcsa: string; docs: string }[] = [];

  try {
    const allOrgs = await db.select({ id: organizations.id }).from(organizations);

    for (const org of allOrgs) {
      const orgResult = { orgId: org.id, fmcsa: "ok", docs: "ok" };
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
      results.push(orgResult);
    }

    console.log(`[CRON] Daily tasks completed for ${allOrgs.length} organizations`);
    return NextResponse.json({ success: true, orgsProcessed: allOrgs.length, results });
  } catch (error) {
    console.error("[CRON] Daily cron failed:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
