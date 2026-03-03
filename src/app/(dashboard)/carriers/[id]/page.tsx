import { db } from "@/lib/db";
import { carriers, carrierDocuments, carrierVerifications, loads, alerts } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, ShieldCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { CarrierTabs } from "@/components/carriers/carrier-tabs";

function getStatusVariant(status: string | null) {
  switch (status) {
    case "verified": return "default" as const;
    case "pending": return "secondary" as const;
    case "flagged": case "suspended": return "destructive" as const;
    default: return "outline" as const;
  }
}

export default async function CarrierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect("/login");

  const [carrier] = await db.select().from(carriers)
    .where(and(eq(carriers.id, id), eq(carriers.orgId, orgId))).limit(1);
  if (!carrier) notFound();

  const documents = await db.select().from(carrierDocuments)
    .where(eq(carrierDocuments.carrierId, id)).orderBy(desc(carrierDocuments.createdAt));

  const verifications = await db.select().from(carrierVerifications)
    .where(eq(carrierVerifications.carrierId, id)).orderBy(desc(carrierVerifications.createdAt));

  const carrierLoads = await db.select({
    id: loads.id, referenceNumber: loads.referenceNumber, status: loads.status,
    originName: loads.originName, destinationName: loads.destinationName, pickupDate: loads.pickupDate,
  }).from(loads).where(and(eq(loads.carrierId, id), eq(loads.orgId, orgId))).orderBy(desc(loads.createdAt));

  const carrierAlerts = await db.select({
    id: alerts.id, alertType: alerts.alertType, severity: alerts.severity,
    title: alerts.title, status: alerts.status, createdAt: alerts.createdAt,
  }).from(alerts).where(and(eq(alerts.carrierId, id), eq(alerts.orgId, orgId))).orderBy(desc(alerts.createdAt));

  const serializedCarrier = {
    ...carrier,
    fmcsaLastCheck: carrier.fmcsaLastCheck?.toISOString() ?? null,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/carriers" className="text-sm text-muted-foreground hover:underline">Back to Carriers</Link>
          <div className="flex items-center gap-3 mt-2">
            <Truck className="h-6 w-6" />
            <h2 className="text-2xl font-bold tracking-tight">{carrier.legalName}</h2>
            <Badge variant={getStatusVariant(carrier.status)}>{carrier.status || "pending"}</Badge>
            {carrier.insuranceOnFile && <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" /> Insurance</Badge>}
          </div>
          {carrier.dbaName && <p className="text-muted-foreground mt-1">DBA: {carrier.dbaName}</p>}
          <p className="text-sm text-muted-foreground">DOT# {carrier.dotNumber} | MC# {carrier.mcNumber || "N/A"}</p>
        </div>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Re-verify with FMCSA
        </Button>
      </div>

      <CarrierTabs
        carrier={serializedCarrier}
        documents={documents.map((d) => ({
          id: d.id, docType: d.docType, fileName: d.fileName,
          verified: d.verified, expiresAt: d.expiresAt?.toISOString() ?? null,
          createdAt: d.createdAt?.toISOString() ?? null,
        }))}
        verifications={verifications.map((v) => ({
          id: v.id, checkType: v.checkType, status: v.status,
          createdAt: v.createdAt?.toISOString() ?? null,
        }))}
        loads={carrierLoads.map((l) => ({
          ...l, pickupDate: l.pickupDate?.toISOString() ?? null,
        }))}
        alerts={carrierAlerts.map((a) => ({
          ...a, createdAt: a.createdAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
