import { db } from "@/lib/db";
import { loads, carriers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { MapPin, Calendar, Package, DollarSign, ArrowRight } from "lucide-react";
import { TenderActions } from "@/components/loads/tender-actions";

export default async function TenderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Find load by tender token
  const [load] = await db.select().from(loads).where(eq(loads.tenderToken, token)).limit(1);
  if (!load) notFound();

  let carrier = null;
  if (load.carrierId) {
    const [c] = await db.select().from(carriers).where(eq(carriers.id, load.carrierId)).limit(1);
    carrier = c ?? null;
  }

  const isExpired = load.tenderExpiresAt ? new Date() > load.tenderExpiresAt : false;
  const isActive = load.status === "tendered" && !isExpired;

  const fmtDate = (d: Date | null) => d ? format(d, "MMM d, yyyy h:mm a") : "Not set";
  const fmtMoney = (cents: number | null) => cents != null ? "$" + (cents / 100).toFixed(2) : "Not disclosed";

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">FreightVerify</h1>
          <p className="text-muted-foreground">Load Tender</p>
        </div>

        {!isActive && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-lg font-semibold">
                {isExpired ? "This tender has expired." : "This tender is no longer active."}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Current load status: {(load.status || "unknown").replace("_", " ")}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Load {load.referenceNumber}</CardTitle>
              <Badge variant="outline">{(load.status || "draft").replace("_", " ")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-1 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Origin: {load.originName}</p>
                  <p className="text-xs text-muted-foreground">{load.originAddress}</p>
                </div>
              </div>
              <div className="flex justify-center"><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-1 text-red-600" />
                <div>
                  <p className="text-sm font-medium">Destination: {load.destinationName}</p>
                  <p className="text-xs text-muted-foreground">{load.destinationAddress}</p>
                </div>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Pickup</p><p className="font-medium">{fmtDate(load.pickupDate)}</p></div></div>
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Delivery</p><p className="font-medium">{fmtDate(load.deliveryDate)}</p></div></div>
              <div className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Commodity</p><p className="font-medium">{load.commodity || "Not specified"}</p></div></div>
              <div><p className="text-xs text-muted-foreground">Weight</p><p className="font-medium">{load.weightLbs ? load.weightLbs.toLocaleString() + " lbs" : "Not set"}</p></div>
              <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Rate</p><p className="font-medium">{fmtMoney(load.rateCents)}</p></div></div>
            </div>
          </CardContent>
        </Card>

        {isActive && <TenderActions loadId={load.id} token={token} />}
      </div>
    </div>
  );
}
