import { db } from "@/lib/db";
import { loads, carriers, loadEvents, loadDocuments, loadMessages, pickupVerifications } from "@/lib/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { StatusActions } from "@/components/loads/status-actions";
import { LoadDocuments } from "@/components/loads/load-documents";
import { MessageThread } from "@/components/loads/message-thread";
import { VerificationTimeline } from "@/components/verification/verification-timeline";
import { VerificationReceipt } from "@/components/verification/verification-receipt";
import { GeneratePickupCode } from "@/components/verification/generate-pickup-code";
import { EventFeed } from "@/components/events/event-feed";
import { ChainIntegrityChecker } from "@/components/events/chain-integrity-checker";
import { MapPin, Calendar, Truck, Package, DollarSign, Clock, ArrowRight, Shield, ShieldCheck, Activity } from "lucide-react";

function getStatusVariant(status: string) {
  switch (status) {
    case "completed": case "delivered": return "default" as const;
    case "in_transit": case "accepted": return "secondary" as const;
    case "draft": case "tendered": return "outline" as const;
    case "cancelled": return "destructive" as const;
    default: return "secondary" as const;
  }
}

export default async function LoadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect("/login");

  const [load] = await db.select().from(loads).where(eq(loads.id, id)).limit(1);
  if (!load) notFound();

  let carrier = null;
  if (load.carrierId) {
    const [c] = await db.select().from(carriers).where(eq(carriers.id, load.carrierId)).limit(1);
    carrier = c ?? null;
  }

  const events = await db.select().from(loadEvents).where(eq(loadEvents.loadId, id)).orderBy(desc(loadEvents.createdAt));
  const docs = await db.select().from(loadDocuments).where(eq(loadDocuments.loadId, id)).orderBy(desc(loadDocuments.createdAt));
  const msgs = await db.select().from(loadMessages).where(eq(loadMessages.loadId, id)).orderBy(loadMessages.createdAt);
  const [verification] = await db.select().from(pickupVerifications)
    .where(eq(pickupVerifications.loadId, id)).orderBy(desc(pickupVerifications.createdAt)).limit(1);

  const fmtDate = (d: Date | null) => d ? format(d, "MMM d, yyyy h:mm a") : "Not set";
  const fmtMoney = (cents: number | null) => cents != null ? "$" + (cents / 100).toFixed(2) : "Not set";

  const timelineEvents = events.map((e) => ({
    id: e.id, eventType: e.eventType, description: e.description, actorType: e.actorType,
    geoLat: e.geoLat, geoLng: e.geoLng, metadata: e.metadata, createdAt: e.createdAt?.toISOString() ?? null,
  }));

  const feedEvents = events.map((e) => ({
    id: e.id, eventType: e.eventType, description: e.description,
    actorId: e.actorId, actorType: e.actorType,
    eventHash: e.eventHash, prevHash: e.prevHash,
    metadata: e.metadata, createdAt: e.createdAt?.toISOString() ?? null,
    loadId: e.loadId, referenceNumber: load.referenceNumber ?? null,
    carrierName: carrier?.legalName ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{load.referenceNumber || "Load"}</h2>
            <Badge variant={getStatusVariant(load.status || "draft")} className="text-sm">
              {(load.status || "draft").replace("_", " ")}
            </Badge>
            {verification && (
              <Badge variant={verification.verificationStatus === "verified" ? "default" : "secondary"} className="text-sm">
                <ShieldCheck className="h-3 w-3 mr-1" />{verification.verificationStatus}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">Load ID: {id}</p>
        </div>
      </div>

      <StatusActions loadId={id} status={load.status || "draft"} carrierId={load.carrierId} orgId={orgId} userId={userId} />

      {load.status === "accepted" && !verification && <GeneratePickupCode loadId={id} />}

      {load.status === "accepted" && verification && verification.verificationStatus === "pending" && (
        <Card><CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-600" /><span className="font-medium">Verification code generated</span></div>
            <a href={"/verify/" + id} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">View Dock Verification Page</a>
          </div>
        </CardContent></Card>
      )}

      {verification && verification.verificationStatus === "verified" && (
        <VerificationReceipt loadReference={load.referenceNumber} carrierName={carrier?.legalName ?? null}
          driverName={verification.driverName} verifiedAt={verification.verifiedAt?.toISOString() ?? null}
          geoLat={verification.geoLat} geoLng={verification.geoLng} photoUrls={verification.photoUrls} loadId={id} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Load Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-1 text-green-600" />
                <div><p className="text-sm font-medium">Origin</p><p className="text-sm text-muted-foreground">{load.originName}</p><p className="text-xs text-muted-foreground">{load.originAddress}</p></div>
              </div>
              <div className="flex items-center justify-center"><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-1 text-red-600" />
                <div><p className="text-sm font-medium">Destination</p><p className="text-sm text-muted-foreground">{load.destinationName}</p><p className="text-xs text-muted-foreground">{load.destinationAddress}</p></div>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Pickup</p><p className="font-medium">{fmtDate(load.pickupDate)}</p></div></div>
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Delivery</p><p className="font-medium">{fmtDate(load.deliveryDate)}</p></div></div>
              <div><p className="text-xs text-muted-foreground">Commodity</p><p className="font-medium">{load.commodity || "Not specified"}</p></div>
              <div><p className="text-xs text-muted-foreground">Weight</p><p className="font-medium">{load.weightLbs ? load.weightLbs.toLocaleString() + " lbs" : "Not set"}</p></div>
              <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Rate</p><p className="font-medium">{fmtMoney(load.rateCents)}</p></div></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Assigned Carrier</CardTitle></CardHeader>
          <CardContent>
            {carrier ? (
              <div className="space-y-3">
                <div><p className="text-lg font-semibold">{carrier.legalName}</p>{carrier.dbaName && <p className="text-sm text-muted-foreground">DBA: {carrier.dbaName}</p>}</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">DOT Number</p><p className="font-medium">{carrier.dotNumber}</p></div>
                  <div><p className="text-xs text-muted-foreground">MC Number</p><p className="font-medium">{carrier.mcNumber || "N/A"}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={carrier.status === "verified" ? "default" : "destructive"}>{carrier.status}</Badge>
                  {carrier.insuranceOnFile && <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> Insurance</Badge>}
                </div>
              </div>
            ) : (<p className="text-sm text-muted-foreground py-6 text-center">No carrier assigned</p>)}
          </CardContent>
        </Card>
      </div>

      <VerificationTimeline events={timelineEvents} verificationStatus={verification?.verificationStatus ?? null} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Full Event Log</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChainIntegrityChecker loadId={id} />
          <EventFeed events={feedEvents} showLoadReference={false} />
        </CardContent>
      </Card>

      <LoadDocuments loadId={id} documents={docs.map((d) => ({ id: d.id, docType: d.docType, fileName: d.fileName, fileUrl: d.fileUrl, fileSize: d.fileSize, createdAt: d.createdAt?.toISOString() ?? new Date().toISOString() }))} />
      <MessageThread loadId={id} messages={msgs.map((m) => ({ id: m.id, authorName: m.authorName, authorType: m.authorType, content: m.content, createdAt: m.createdAt?.toISOString() ?? new Date().toISOString() }))} />
    </div>
  );
}
