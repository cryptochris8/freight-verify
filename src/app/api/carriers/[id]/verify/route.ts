import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { carriers, carrierVerifications, organizations, auditLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { lookupCarrier, clearCache } from "@/lib/fmcsa/client";
import { checkFmcsaStatusChange } from "@/lib/alerts/rules";
import { alerts } from "@/lib/db/schema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, orgId: clerkOrgId } = await auth();
    if (!userId || !clerkOrgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const { id } = await params;

    const [carrier] = await db
      .select()
      .from(carriers)
      .where(and(eq(carriers.id, id), eq(carriers.orgId, org.id)))
      .limit(1);

    if (!carrier) {
      return NextResponse.json({ error: "Carrier not found" }, { status: 404 });
    }

    // Clear cache so we get fresh data
    clearCache(carrier.dotNumber);

    const result = await lookupCarrier(carrier.dotNumber);

    if (!result.success || !result.data) {
      // Record failed verification
      await db.insert(carrierVerifications).values({
        carrierId: carrier.id,
        orgId: org.id,
        checkType: "fmcsa_lookup",
        status: "failed",
        details: { error: result.error },
        performedBy: userId,
      });

      return NextResponse.json(
        { success: false, error: result.error || "FMCSA lookup failed" },
        { status: 502 }
      );
    }

    const fmcsaSnapshot = carrier.fmcsaSnapshot as Record<string, unknown> | null;
    const previousStatus = (fmcsaSnapshot?.operatingStatus as string) ?? "";
    const currentStatus = result.data.operatingStatus ?? "";

    // Update carrier with fresh FMCSA data
    await db.update(carriers).set({
      fmcsaSnapshot: result.data as unknown as Record<string, unknown>,
      fmcsaLastCheck: new Date(),
      safetyRating: result.data.safetyRating ?? carrier.safetyRating,
      legalName: result.data.legalName ?? carrier.legalName,
      dbaName: result.data.dbaName ?? carrier.dbaName,
      updatedAt: new Date(),
    }).where(eq(carriers.id, carrier.id));

    // Record successful verification
    await db.insert(carrierVerifications).values({
      carrierId: carrier.id,
      orgId: org.id,
      checkType: "fmcsa_lookup",
      status: "passed",
      details: {
        operatingStatus: currentStatus,
        previousStatus,
        safetyRating: result.data.safetyRating,
      },
      performedBy: userId,
    });

    // Check for status change and create alert if needed
    if (previousStatus && currentStatus && previousStatus !== currentStatus) {
      const alertResult = checkFmcsaStatusChange({
        carrierId: carrier.id,
        dotNumber: carrier.dotNumber,
        previousStatus,
        currentStatus,
      });
      if (alertResult.triggered) {
        await db.insert(alerts).values({
          orgId: org.id,
          carrierId: carrier.id,
          alertType: alertResult.alertType,
          severity: alertResult.severity,
          title: alertResult.title,
          message: alertResult.message,
          metadata: alertResult.metadata,
        });
      }
    }

    // Audit log
    await db.insert(auditLog).values({
      orgId: org.id,
      entityType: "carrier",
      entityId: carrier.id,
      action: "fmcsa_reverify",
      actorId: userId,
      actorType: "user",
      metadata: { operatingStatus: currentStatus, previousStatus },
    });

    return NextResponse.json({
      success: true,
      operatingStatus: currentStatus,
      safetyRating: result.data.safetyRating,
      legalName: result.data.legalName,
    });
  } catch (error) {
    console.error("[CARRIERS VERIFY]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
