"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, AlertTriangle, Loader2 } from "lucide-react";

interface GeoData {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

interface GeoCaptureProps {
  originLat?: string | null;
  originLng?: string | null;
  onCapture: (data: GeoData) => void;
  maxMiles?: number;
}

export function GeoCapture({ originLat, originLng, onCapture, maxMiles = 5 }: GeoCaptureProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "denied" | "error">("idle");
  const [geoData, setGeoData] = useState<GeoData | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  function captureLocation() {
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMsg("Geolocation is not supported by this browser");
      return;
    }

    setStatus("loading");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const data: GeoData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        setGeoData(data);
        setStatus("success");

        if (originLat && originLng) {
          const R = 3958.8;
          const dLat = ((parseFloat(originLat) - data.lat) * Math.PI) / 180;
          const dLng = ((parseFloat(originLng) - data.lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((data.lat * Math.PI) / 180) *
              Math.cos((parseFloat(originLat) * Math.PI) / 180) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const dist = Math.round(R * c * 10) / 10;
          setDistance(dist);
        }

        onCapture(data);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setStatus("denied");
          setErrorMsg("Location permission denied. You can continue without GPS.");
        } else {
          setStatus("error");
          setErrorMsg("Could not get your location: " + error.message);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  useEffect(() => {
    captureLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardContent className="pt-6">
        {status === "loading" && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Capturing your location...</span>
          </div>
        )}

        {status === "success" && geoData && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <MapPin className="h-5 w-5" />
              <span className="font-medium">Location captured</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Lat: {geoData.lat.toFixed(6)}, Lng: {geoData.lng.toFixed(6)}</p>
              <p>Accuracy: {Math.round(geoData.accuracy)}m</p>
            </div>
            {distance !== null && distance > maxMiles && (
              <div className="flex items-start gap-2 rounded-md bg-yellow-50 dark:bg-yellow-950 p-3 text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <span className="text-sm">You appear to be {distance} miles from the pickup location</span>
              </div>
            )}
            {distance !== null && distance <= maxMiles && (
              <div className="text-sm text-green-600">
                Within {distance} miles of pickup location
              </div>
            )}
          </div>
        )}

        {(status === "denied" || status === "error") && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5 mt-0.5" />
              <span className="text-sm">{errorMsg}</span>
            </div>
            <Button variant="outline" size="sm" onClick={captureLocation}>
              Retry Location
            </Button>
          </div>
        )}

        {status === "idle" && (
          <Button onClick={captureLocation}>
            <MapPin className="h-4 w-4 mr-2" />
            Capture Location
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
