import { db } from "@/lib/db";
import { loads, carriers, pickupVerifications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, ShieldCheck } from "lucide-react";
import { OtpVerifyForm } from "@/components/verification/otp-verify-form";

export default async function DockVerificationPage({ params }: { params: Promise<{ loadId: string }> }) {
  const { loadId } = await params;

  const [load] = await db.select().from(loads).where(eq(loads.id, loadId)).limit(1);
  if (!load) notFound();

  let carrier = null;
  if (load.carrierId) {
    const [c] = await db.select().from(carriers).where(eq(carriers.id, load.carrierId)).limit(1);
    carrier = c ?? null;
  }

  const [verification] = await db.select().from(pickupVerifications)
    .where(eq(pickupVerifications.loadId, loadId))
    .orderBy(desc(pickupVerifications.createdAt)).limit(1);

  const isVerified = verification?.verificationStatus === "verified";
  const isFailed = verification?.verificationStatus === "failed";
  const isExpired = verification?.verificationStatus === "expired";

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold">FreightVerify</h1>
          <p className="text-sm text-muted-foreground">Dock Pickup Verification</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Load {load.referenceNumber}</CardTitle>
              <Badge variant="outline">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Verification
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm">
              <p className="text-muted-foreground">Carrier</p>
              <p className="font-medium">{carrier?.legalName ?? "N/A"}</p>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 mt-0.5 text-green-600" />
              <div>
                <p className="text-muted-foreground">Pickup Location</p>
                <p className="font-medium">{load.originName}</p>
                <p className="text-xs text-muted-foreground">{load.originAddress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {!verification && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No verification code has been generated for this load yet.</p>
            </CardContent>
          </Card>
        )}

        {verification && !isVerified && !isFailed && !isExpired && (
          <OtpVerifyForm loadId={loadId} />
        )}

        {isVerified && (
          <Card>
            <CardContent className="py-8 text-center space-y-2">
              <ShieldCheck className="h-12 w-12 text-green-600 mx-auto" />
              <p className="text-lg font-semibold text-green-600">Pickup Verified</p>
              <p className="text-sm text-muted-foreground">This pickup has been verified successfully.</p>
            </CardContent>
          </Card>
        )}

        {isFailed && (
          <Card>
            <CardContent className="py-8 text-center space-y-2">
              <p className="text-lg font-semibold text-red-600">Verification Locked</p>
              <p className="text-sm text-muted-foreground">Too many failed attempts. Contact the broker.</p>
            </CardContent>
          </Card>
        )}

        {isExpired && (
          <Card>
            <CardContent className="py-8 text-center space-y-2">
              <p className="text-lg font-semibold text-yellow-600">Code Expired</p>
              <p className="text-sm text-muted-foreground">The verification code has expired. Request a new one from the broker.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
