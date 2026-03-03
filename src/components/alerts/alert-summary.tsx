"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { AlertTrendChart } from "./alert-trend-chart";
import { acknowledgeAlert } from "@/app/actions/alerts";

interface AlertSummaryProps {
  stats: { critical: number; high: number; medium: number; acknowledged: number; total: number };
  recentAlerts: { id: string; alertType: string; severity: string; title: string; message: string; createdAt: string | null }[];
  trendData: { date: string; critical: number; high: number; medium: number }[];
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical": return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "high": return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
    case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
    default: return "bg-gray-100 text-gray-800";
  }
}

export function AlertSummary({ stats, recentAlerts, trendData }: AlertSummaryProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleQuickAck = (alertId: string) => {
    setPendingId(alertId);
    startTransition(async () => {
      await acknowledgeAlert(alertId, "Quick acknowledged from dashboard");
      setPendingId(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> Alerts
          {stats.critical > 0 && <Badge variant="destructive" className="text-xs">{stats.critical} Critical</Badge>}
        </h3>
        <Link href="/alerts"><Button variant="ghost" size="sm" className="gap-1">View All <ArrowRight className="h-4 w-4" /></Button></Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <AlertTrendChart data={trendData} />
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Recent Unacknowledged</CardTitle></CardHeader>
          <CardContent>
            {recentAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No unacknowledged alerts</p>
            ) : (
              <div className="space-y-2">
                {recentAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border">
                    <Link href={"/alerts/" + alert.id} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " + getSeverityColor(alert.severity)}>{alert.severity}</span>
                        <span className="text-sm truncate">{alert.title}</span>
                      </div>
                    </Link>
                    <Button variant="ghost" size="sm" className="shrink-0 text-xs" disabled={isPending && pendingId === alert.id} onClick={() => handleQuickAck(alert.id)}>Ack</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
