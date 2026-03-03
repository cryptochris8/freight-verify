"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  KeyRound, Send, MapPin, ShieldCheck, Camera, CheckCircle2, XCircle, Clock,
} from "lucide-react";

interface TimelineEvent {
  id: number;
  eventType: string;
  description: string | null;
  actorType: string | null;
  geoLat: string | null;
  geoLng: string | null;
  metadata: unknown;
  createdAt: string | null;
}

interface VerificationTimelineProps {
  events: TimelineEvent[];
  verificationStatus: string | null;
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  pickup_verification_created: { icon: KeyRound, label: "OTP Generated", color: "text-blue-600" },
  otp_sent: { icon: Send, label: "OTP Sent to Driver", color: "text-blue-600" },
  driver_arrived: { icon: MapPin, label: "Driver Arrived", color: "text-green-600" },
  pickup_verified: { icon: ShieldCheck, label: "OTP Verified at Dock", color: "text-green-600" },
  photos_captured: { icon: Camera, label: "Photos Captured", color: "text-purple-600" },
  driver_photos_uploaded: { icon: Camera, label: "Driver Photos Uploaded", color: "text-purple-600" },
  verification_complete: { icon: CheckCircle2, label: "Verification Complete", color: "text-green-600" },
  verification_failed: { icon: XCircle, label: "Verification Failed", color: "text-red-600" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit",
  });
}

export function VerificationTimeline({ events, verificationStatus }: VerificationTimelineProps) {
  const verificationEvents = events.filter(
    (e) => e.eventType in EVENT_CONFIG || e.eventType.startsWith("status_change")
  );

  if (verificationEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5" /> Pickup Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No verification activity yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5" /> Pickup Verification Timeline
          </CardTitle>
          {verificationStatus && (
            <Badge variant={verificationStatus === "verified" ? "default" : verificationStatus === "failed" ? "destructive" : "secondary"}>
              {verificationStatus}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {verificationEvents.map((event, idx) => {
            const config = EVENT_CONFIG[event.eventType] ?? {
              icon: Clock, label: event.eventType.replace(/_/g, " "), color: "text-muted-foreground",
            };
            const Icon = config.icon;
            const isLast = idx === verificationEvents.length - 1;

            return (
              <div key={event.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={"rounded-full p-1 " + config.color}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {!isLast && <div className="flex-1 w-px bg-border mt-1" />}
                </div>
                <div className="pb-4 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{config.label}</p>
                    {event.actorType && (
                      <Badge variant="outline" className="text-xs">{event.actorType}</Badge>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
                  )}
                  {event.geoLat && event.geoLng && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      GPS: {parseFloat(event.geoLat).toFixed(4)}, {parseFloat(event.geoLng).toFixed(4)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(event.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
