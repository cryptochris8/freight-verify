"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, AlertTriangle, CheckCircle2, Loader2, Camera, Upload } from "lucide-react";
import { GeoCapture } from "./geo-capture";

interface DriverArrivalClientProps {
  loadId: string;
  originLat: string | null;
  originLng: string | null;
  hasArrived: boolean;
  verificationStatus: string | null;
}

export function DriverArrivalClient({
  loadId, originLat, originLng, hasArrived, verificationStatus,
}: DriverArrivalClientProps) {
  const [arrived, setArrived] = useState(hasArrived);
  const [geoData, setGeoData] = useState<{ lat: number; lng: number; accuracy: number; timestamp: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinRange, setIsWithinRange] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);

  function handleGeoCapture(data: { lat: number; lng: number; accuracy: number; timestamp: number }) {
    setGeoData(data);
    if (originLat && originLng) {
      const R = 3958.8;
      const dLat = ((parseFloat(originLat) - data.lat) * Math.PI) / 180;
      const dLng = ((parseFloat(originLng) - data.lng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((data.lat * Math.PI) / 180) * Math.cos((parseFloat(originLat) * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = Math.round(R * c * 10) / 10;
      setDistance(dist);
      setIsWithinRange(dist <= 1);
      if (dist > 1) setShowConfirm(true);
    }
  }

  function handleArrival() {
    if (!geoData) {
      setError("Please wait for location capture.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/verification/arrival", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loadId, lat: geoData.lat, lng: geoData.lng, accuracy: geoData.accuracy }),
        });
        const result = await res.json();
        if (result.success) {
          setArrived(true);
        } else {
          setError(result.message);
        }
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append("loadId", loadId);
    formData.append("photoType", "driver_upload");
    formData.append("file", file);

    fetch("/api/verification/photos", { method: "POST", body: formData })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setPhotoCount((c) => c + 1);
        else setError("Failed to upload photo");
      })
      .catch(() => setError("Network error uploading photo"))
      .finally(() => setUploadingPhoto(false));
  }

  if (!arrived) {
    return (
      <div className="space-y-4">
        <GeoCapture originLat={originLat} originLng={originLng} onCapture={handleGeoCapture} maxMiles={1} />

        {distance !== null && !isWithinRange && showConfirm && (
          <Card>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-start gap-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">
                    You appear to be {distance} miles from the pickup location.
                  </p>
                  <p className="text-xs text-muted-foreground">GPS may be imprecise.</p>
                </div>
              </div>
              <Button onClick={handleArrival} disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Confirm Arrival Anyway
              </Button>
            </CardContent>
          </Card>
        )}

        {(isWithinRange || !showConfirm) && geoData && (
          <Button onClick={handleArrival} disabled={isPending} className="w-full" size="lg">
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
            I Have Arrived
          </Button>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive text-center">{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-6 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
          <p className="text-lg font-semibold">Arrival Recorded</p>
          <Separator />
          <div className="pt-2">
            <p className="text-sm text-muted-foreground mb-1">Show this code to dock staff:</p>
            <div className="bg-primary text-primary-foreground rounded-lg py-4 px-6">
              <p className="text-3xl font-mono font-bold tracking-widest">
                {verificationStatus === "verified" ? "VERIFIED" : "------"}
              </p>
              <p className="text-xs mt-1 opacity-80">
                {verificationStatus === "verified" ? "Already verified" : "OTP code sent to your phone"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" /> Upload Photos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload truck/trailer photos, signed BOL, or other documents.
          </p>
          {photoCount > 0 && (
            <Badge variant="secondary">
              <CheckCircle2 className="h-3 w-3 mr-1" /> {photoCount} photo(s) uploaded
            </Badge>
          )}
          <label className="flex items-center justify-center gap-2 rounded-md border border-dashed p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            {uploadingPhoto ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">
              {uploadingPhoto ? "Uploading..." : "Tap to upload a photo"}
            </span>
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={handlePhotoUpload} disabled={uploadingPhoto} />
          </label>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive text-center">{error}</div>
      )}
    </div>
  );
}
