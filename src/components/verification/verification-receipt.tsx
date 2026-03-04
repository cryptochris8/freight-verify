"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, MapPin, Camera, Clock, Mail, Printer } from "lucide-react";

interface VerificationReceiptProps {
  loadReference: string | null;
  carrierName: string | null;
  driverName: string | null;
  verifiedAt: string | null;
  geoLat: string | null;
  geoLng: string | null;
  photoUrls: string[] | null;
  loadId: string;
}

export function VerificationReceipt({
  loadReference, carrierName, driverName, verifiedAt,
  geoLat, geoLng, photoUrls, loadId,
}: VerificationReceiptProps) {
  async function handleEmailReceipt() {
    const email = prompt("Enter broker email address:");
    if (!email) return;

    try {
      const res = await fetch("/api/verification/receipt/" + loadId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await res.json();
      if (result.success) {
        alert("Verification receipt sent to " + email);
      } else {
        alert("Failed to send receipt: " + (result.error ?? "Unknown error"));
      }
    } catch {
      alert("Failed to send receipt email.");
    }
  }

  function handlePrint() {
    window.print();
  }

  const fmtDate = (d: string | null) => {
    if (!d) return "N/A";
    return new Date(d).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", second: "2-digit",
    });
  };

  return (
    <Card className="print:shadow-none print:border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            Verification Complete
          </CardTitle>
          <Badge className="bg-green-600 text-white">Verified</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Load Reference</p>
            <p className="font-medium">{loadReference ?? "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Carrier</p>
            <p className="font-medium">{carrierName ?? "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Driver</p>
            <p className="font-medium">{driverName ?? "N/A"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Verified At
            </p>
            <p className="font-medium">{fmtDate(verifiedAt)}</p>
          </div>
        </div>

        <Separator />

        {geoLat && geoLng && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>GPS: {parseFloat(geoLat).toFixed(6)}, {parseFloat(geoLng).toFixed(6)}</span>
          </div>
        )}

        {photoUrls && photoUrls.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm mb-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <span>{photoUrls.length} photo(s) captured</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {photoUrls.map((url, i) => (
                <div key={i} className="aspect-square bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">
                  Photo {i + 1}
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handleEmailReceipt}>
            <Mail className="h-4 w-4 mr-2" />
            Email Receipt to Broker
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
