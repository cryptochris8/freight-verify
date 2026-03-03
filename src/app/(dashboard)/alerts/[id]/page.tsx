import { db } from "@/lib/db";
import { alerts, loads, carriers, loadEvents } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  AlertTriangle, ShieldAlert, FileWarning, MapPin, XCircle,
  FileX, Radio, Truck, Package, ArrowRight, Shield, CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { getRecommendation } from "@/lib/alerts/recommendations";
import { AlertAckForm } from "@/components/alerts/alert-ack-form";

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "critical": return <Badge variant="destructive" className="text-sm">Critical</Badge>;
    case "high": return <Badge className="bg-orange-500 text-white text-sm">High</Badge>;
    case "medium": return <Badge className="bg-yellow-500 text-white text-sm">Medium</Badge>;
    default: return <Badge variant="secondary" className="text-sm">{severity}</Badge>;
  }
}

function getAlertIcon(alertType: string) {
  switch (alertType) {
    case "carrier_substitution": return ShieldAlert;
    case "domain_mismatch": return FileWarning;
    case "off_location_pickup": return MapPin;
    case "failed_verification": return XCircle;
    case "document_expiration": return FileX;
    case "fmcsa_status_change": return Radio;
    default: return AlertTriangle;
  }
}

export default async function AlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect("/login");

  const [alert] = await db.select().from(alerts)
    .where(and(eq(alerts.id, id), eq(alerts.orgId, orgId))).limit(1);
  if (!alert) notFound();

  let load = null;
  if (alert.loadId) {
    const [l] = await db.select().from(loads).where(eq(loads.id, alert.loadId)).limit(1);
    load = l ?? null;
  }

  let carrier = null;
  if (alert.carrierId) {
    const [c] = await db.select().from(carriers).where(eq(carriers.id, alert.carrierId)).limit(1);
    carrier = c ?? null;
  }

  let relatedEvents: { id: number; eventType: string; description: string | null; createdAt: Date | null }[] = [];
  if (alert.loadId) {
    relatedEvents = await db.select({ id: loadEvents.id, eventType: loadEvents.eventType, description: loadEvents.description, createdAt: loadEvents.createdAt })
      .from(loadEvents).where(eq(loadEvents.loadId, alert.loadId)).orderBy(desc(loadEvents.createdAt)).limit(10);
  }

  const Icon = getAlertIcon(alert.alertType);
  const recommendation = getRecommendation(alert.alertType);
  const fmtType = (t: string) => t.replace(/_/g, " ").split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/alerts" className="text-sm text-muted-foreground hover:underline">Back to Alerts</Link>
        <div className="flex items-center gap-3 mt-2">
          <Icon className="h-6 w-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold tracking-tight">{alert.title}</h2>
          {getSeverityBadge(alert.severity)}
          <Badge variant={alert.status === "acknowledged" ? "outline" : "secondary"}>
            {alert.status === "acknowledged" ? "Acknowledged" : "New"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Alert Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><p className="text-sm text-muted-foreground">Type</p><p className="font-medium">{fmtType(alert.alertType)}</p></div>
            <div><p className="text-sm text-muted-foreground">Description</p><p className="text-sm">{alert.message}</p></div>
            <div><p className="text-sm text-muted-foreground">Created</p><p className="text-sm">{alert.createdAt ? format(alert.createdAt, "MMM d, yyyy h:mm:ss a") : "Unknown"}</p></div>
            {alert.metadata != null ? (<div><p className="text-sm text-muted-foreground">Metadata</p><pre className="mt-1 text-xs font-mono bg-muted p-2 rounded overflow-x-auto max-h-32">{JSON.stringify(alert.metadata, null, 2)}</pre></div>) : null}
          </CardContent>
        </Card>
        <Card className="border-blue-500/30">
          <CardHeader><CardTitle className="text-base text-blue-700">Recommended Action</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{recommendation}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {load && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Package className="h-5 w-5" /> Related Load</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Link href={"/loads/" + load.id} className="text-blue-600 hover:underline font-medium">{load.referenceNumber || load.id}</Link>
              <Badge variant="outline">{(load.status || "draft").replace(/_/g, " ")}</Badge>
              {load.originName && load.destinationName && <p className="text-sm text-muted-foreground">{load.originName} <ArrowRight className="h-3 w-3 inline" /> {load.destinationName}</p>}
            </CardContent>
          </Card>
        )}
        {carrier && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Truck className="h-5 w-5" /> Related Carrier</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Link href={"/carriers/" + carrier.id} className="text-blue-600 hover:underline font-medium">{carrier.legalName}</Link>
              <div className="flex items-center gap-2">
                <Badge variant={carrier.status === "verified" ? "default" : "secondary"}>{carrier.status || "pending"}</Badge>
                <span className="text-sm text-muted-foreground">DOT# {carrier.dotNumber}</span>
              </div>
              {carrier.insuranceOnFile && <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> Insurance</Badge>}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Acknowledgment</CardTitle></CardHeader>
        <CardContent>
          {alert.status === "acknowledged" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /><span className="font-medium">Acknowledged</span></div>
              <p className="text-sm text-muted-foreground">By: {alert.acknowledgedBy || "Unknown"}</p>
              <p className="text-sm text-muted-foreground">At: {alert.acknowledgedAt ? format(alert.acknowledgedAt, "MMM d, yyyy h:mm a") : "Unknown"}</p>
              {alert.acknowledgeNote && <div className="mt-2 p-3 bg-muted rounded-md"><p className="text-sm font-medium">Notes:</p><p className="text-sm">{alert.acknowledgeNote}</p></div>}
            </div>
          ) : (
            <AlertAckForm alertId={id} />
          )}
        </CardContent>
      </Card>

      {relatedEvents.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Related Events</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {relatedEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="text-sm font-medium">{event.eventType.replace(/_/g, " ").replace(/:/g, " - ")}</p>
                    {event.description && <p className="text-xs text-muted-foreground">{event.description}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{event.createdAt ? format(event.createdAt, "MMM d, h:mm a") : ""}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
