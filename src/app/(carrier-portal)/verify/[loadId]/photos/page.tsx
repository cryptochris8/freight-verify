"use client";

import { useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { GeoCapture } from "@/components/verification/geo-capture";

interface PhotoEntry {
  id: string;
  type: string;
  name: string;
  preview: string | null;
}

const PHOTO_TYPES = [
  { id: "truck", label: "Truck Photo" },
  { id: "trailer", label: "Trailer Number Photo" },
  { id: "driver_id", label: "Driver ID (Optional)" },
];

export default function PhotoCapturePage() {
  const { loadId } = useParams<{ loadId: string }>();
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<{ lat: number; lng: number; accuracy: number; timestamp: number } | null>(null);

  function handleFileCapture(photoType: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const entry: PhotoEntry = {
      id: Date.now().toString(),
      type: photoType,
      name: file.name,
      preview: URL.createObjectURL(file),
    };
    setPhotos((prev) => [...prev, entry]);

    // Upload in background
    startTransition(async () => {
      const formData = new FormData();
      formData.append("loadId", loadId);
      formData.append("photoType", photoType);
      formData.append("file", file);

      try {
        const res = await fetch("/api/verification/photos", { method: "POST", body: formData });
        const result = await res.json();
        if (!result.success) {
          setError("Failed to upload " + photoType + ": " + (result.error ?? "Unknown error"));
        }
      } catch {
        setError("Network error uploading photo.");
      }
    });
  }

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleComplete() {
    if (photos.length === 0) {
      setError("Please take at least one photo before completing verification.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/verification/receipt/" + loadId);
        if (res.ok) {
          router.push("/verify/" + loadId);
        }
      } catch {
        setError("Failed to complete verification.");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold">FreightVerify</h1>
          <p className="text-sm text-muted-foreground">Photo Evidence Capture</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="h-5 w-5" />
              Take Verification Photos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Take photos of the truck, trailer number, and optionally the driver ID.
            </p>

            {PHOTO_TYPES.map((pt) => {
              const existing = photos.filter((p) => p.type === pt.id);
              return (
                <div key={pt.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">{pt.label}</label>
                    {existing.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {existing.length} captured
                      </Badge>
                    )}
                  </div>

                  {existing.map((photo) => (
                    <div key={photo.id} className="flex items-center gap-2 rounded-md border p-2">
                      <div className="h-12 w-12 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                        {photo.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo.preview} alt={pt.label} className="h-12 w-12 object-cover rounded" />
                        ) : (
                          <Camera className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-sm flex-1 truncate">{photo.name}</span>
                      <Button variant="ghost" size="icon" onClick={() => removePhoto(photo.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <label className="flex items-center justify-center gap-2 rounded-md border border-dashed p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {existing.length > 0 ? "Add Another" : "Capture " + pt.label}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleFileCapture(pt.id, e)}
                    />
                  </label>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <GeoCapture onCapture={setGeoData} />

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        <Button
          onClick={handleComplete}
          disabled={photos.length === 0 || isPending}
          className="w-full"
          size="lg"
        >
          {isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
          ) : (
            "Complete Verification"
          )}
        </Button>
      </div>
    </div>
  );
}
