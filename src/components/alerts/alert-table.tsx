"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle, ShieldAlert, FileWarning, MapPin, XCircle,
  FileX, Radio, CheckCircle2, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { acknowledgeAlert } from "@/app/actions/alerts";

interface AlertRow {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  status: string | null;
  loadId: string | null;
  carrierId: string | null;
  loadReference: string | null;
  carrierName: string | null;
  createdAt: string | null;
}

interface AlertTableProps {
  alerts: AlertRow[];
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "critical": return <Badge variant="destructive">Critical</Badge>;
    case "high": return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">High</Badge>;
    case "medium": return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">Medium</Badge>;
    case "low": return <Badge variant="secondary">Low</Badge>;
    default: return <Badge variant="outline">{severity}</Badge>;
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatAlertType(alertType: string): string {
  return alertType.replace(/_/g, " ").split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function AlertTable({ alerts }: AlertTableProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAcknowledge = (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingId(alertId);
    startTransition(async () => {
      await acknowledgeAlert(alertId, "Quick acknowledged from alert table");
      setPendingId(null);
      router.refresh();
    });
  };

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No alerts match your filters.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Severity</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="max-w-[300px]">Description</TableHead>
            <TableHead>Load / Carrier</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert) => {
            const Icon = getAlertIcon(alert.alertType);
            return (
              <TableRow key={alert.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push("/alerts/" + alert.id)}>
                <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatAlertType(alert.alertType)}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-[300px]"><p className="text-sm truncate">{alert.message}</p></TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {alert.loadReference && (
                      <Link href={"/loads/" + alert.loadId} className="text-xs text-blue-600 hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {alert.loadReference} <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                    {alert.carrierName && <p className="text-xs text-muted-foreground">{alert.carrierName}</p>}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(alert.createdAt)}</TableCell>
                <TableCell>
                  {alert.status === "acknowledged" ? (
                    <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Ack</Badge>
                  ) : (
                    <Badge variant="secondary">New</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {alert.status !== "acknowledged" && (
                    <Button variant="ghost" size="sm" disabled={isPending && pendingId === alert.id} onClick={(e) => handleAcknowledge(alert.id, e)}>Ack</Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
