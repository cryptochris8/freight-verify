"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Package, Truck, ShieldCheck, Camera, KeyRound, MapPin, AlertTriangle,
  CheckCircle2, XCircle, Send, ArrowRightLeft, ChevronDown, ChevronUp,
  Activity, Hash,
} from "lucide-react";
import Link from "next/link";

interface EventRow {
  id: number;
  eventType: string;
  description: string | null;
  actorId: string | null;
  actorType: string | null;
  eventHash: string | null;
  prevHash: string | null;
  metadata: unknown;
  createdAt: string | null;
  loadId: string;
  referenceNumber: string | null;
  carrierName: string | null;
}

interface EventFeedProps {
  events: EventRow[];
  showLoadReference?: boolean;
}

function getEventCategory(eventType: string): "load" | "verification" | "alert" | "system" {
  if (eventType.startsWith("status_change") || eventType === "load_created" || eventType === "carrier_assigned") return "load";
  if (eventType.includes("verif") || eventType.includes("pickup") || eventType.includes("driver") || eventType.includes("photo") || eventType.includes("otp")) return "verification";
  if (eventType.includes("alert") || eventType.includes("failed")) return "alert";
  return "system";
}

function getCategoryColor(category: string) {
  switch (category) {
    case "load": return "text-blue-600 bg-blue-50 dark:bg-blue-950/30";
    case "verification": return "text-green-600 bg-green-50 dark:bg-green-950/30";
    case "alert": return "text-red-600 bg-red-50 dark:bg-red-950/30";
    default: return "text-gray-600 bg-gray-50 dark:bg-gray-950/30";
  }
}

function getEventIcon(eventType: string) {
  if (eventType === "load_created") return Package;
  if (eventType.startsWith("status_change")) return ArrowRightLeft;
  if (eventType === "carrier_assigned") return Truck;
  if (eventType === "pickup_verification_created") return KeyRound;
  if (eventType === "otp_sent") return Send;
  if (eventType === "driver_arrived") return MapPin;
  if (eventType === "pickup_verified") return ShieldCheck;
  if (eventType === "photos_captured" || eventType === "driver_photos_uploaded") return Camera;
  if (eventType === "verification_complete") return CheckCircle2;
  if (eventType === "verification_failed") return XCircle;
  if (eventType.includes("alert")) return AlertTriangle;
  return Activity;
}

function getActorBadgeVariant(actorType: string | null) {
  switch (actorType) {
    case "user": return "default" as const;
    case "carrier": return "secondary" as const;
    case "driver": return "outline" as const;
    default: return "secondary" as const;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit",
  });
}

function formatEventType(eventType: string): string {
  return eventType
    .replace(/:/g, " - ")
    .replace(/_/g, " ")
    .replace(/->/g, " -> ")
    .split(" ")
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function EventFeed({ events, showLoadReference = true }: EventFeedProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No events recorded yet.</p>;
  }

  return (
    <div className="space-y-1">
      {events.map((event) => {
        const category = getEventCategory(event.eventType);
        const colorClass = getCategoryColor(category);
        const Icon = getEventIcon(event.eventType);
        const isExpanded = expandedRows.has(event.id);
        return (
          <div key={event.id} className="border rounded-lg">
            <button onClick={() => toggleRow(event.id)} className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left">
              <div className={"rounded-full p-1.5 shrink-0 " + colorClass}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{formatEventType(event.eventType)}</span>
                  <Badge variant={getActorBadgeVariant(event.actorType)} className="text-xs">{event.actorType || "system"}</Badge>
                  {event.eventHash && <Hash className="h-3 w-3 text-muted-foreground/50" />}
                </div>
                {event.description && <p className="text-sm text-muted-foreground truncate">{event.description}</p>}
              </div>
              {showLoadReference && event.referenceNumber && (
                <div className="shrink-0 text-right hidden sm:block">
                  <p className="text-xs font-medium">{event.referenceNumber}</p>
                  {event.carrierName && <p className="text-xs text-muted-foreground">{event.carrierName}</p>}
                </div>
              )}
              <div className="shrink-0 text-right">
                <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(event.createdAt)}</p>
              </div>
              <div className="shrink-0">
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>
            {isExpanded && (
              <div className="border-t px-4 py-3 bg-muted/30 space-y-2">
                {showLoadReference && event.referenceNumber && (
                  <div className="text-sm"><span className="text-muted-foreground">Load: </span><Link href={"/loads/" + event.loadId} className="text-blue-600 hover:underline">{event.referenceNumber}</Link></div>
                )}
                {event.carrierName && <div className="text-sm"><span className="text-muted-foreground">Carrier: </span><span>{event.carrierName}</span></div>}
                <div className="text-sm"><span className="text-muted-foreground">Event Hash: </span><code className="text-xs font-mono break-all">{event.eventHash || "N/A"}</code></div>
                <div className="text-sm"><span className="text-muted-foreground">Previous Hash: </span><code className="text-xs font-mono break-all">{event.prevHash || "GENESIS"}</code></div>
                {event.metadata != null ? (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Metadata:</span>
                    <pre className="mt-1 text-xs font-mono bg-muted p-2 rounded overflow-x-auto max-h-48">{JSON.stringify(event.metadata, null, 2)}</pre>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
