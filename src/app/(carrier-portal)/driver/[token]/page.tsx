import { db } from "@/lib/db";
import { loads, carriers, pickupVerifications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Calendar, Truck } from "lucide-react";
import { format } from "date-fns";
import { DriverArrivalClient } from "@/components/verification/driver-arrival-client";

export default async function DriverLandingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Find load by ID (token is the loadId for now)
  // TODO: Use a separate driver token for security
  const [load] = await db.select().from(loads).where(eq(loads.id, token)).limit(1);
  if (!load) notFound();

  let carrier = null;
  if (load.carrierId) {
    const [c] = await db.select().from(carriers).where(eq(carriers.id, load.carrierId)).limit(1);
    carrier = c ?? null;
  }

  const [verification] = await db.select().from(pickupVerifications)
    .where(eq(pickupVerifications.loadId, load.id))
    .orderBy(desc(pickupVerifications.createdAt)).limit(1);

  const fmtDate = (d: Date | null) => d ? format(d, "MMM d, yyyy h:mm a") : "Not set";

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold">FreightVerify</h1>
          <p className="text-sm text-muted-foreground">Driver Portal</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Load {load.referenceNumber}</CardTitle>
              <Badge variant="outline">{(load.status ?? "draft").replace("_", " ")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 mt-0.5 text-green-600" />
              <div>
                <p className="text-muted-foreground">Pickup Location</p>
                <p className="font-medium">{load.originName}</p>
                <p className="text-xs text-muted-foreground">{load.originAddress}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Pickup Time</p>
                <p className="font-medium">{fmtDate(load.pickupDate)}</p>
              </div>
            </div>
            {carrier && (
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Carrier</p>
                  <p className="font-medium">{carrier.legalName}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {verification && (
          <DriverArrivalClient
            loadId={load.id}
            originLat={load.originLat}
            originLng={load.originLng}
            hasArrived={!!verification.geoTimestamp}
            verificationStatus={verification.verificationStatus}
          />
        )}

        {!verification && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No verification code has been generated yet. Your broker will send you a code before pickup.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
