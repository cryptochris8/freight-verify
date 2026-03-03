import { db } from "@/lib/db";
import { alerts, loads, carriers } from "@/lib/db/schema";
import { eq, and, desc, gte, lte, count } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert, Bell } from "lucide-react";
import Link from "next/link";
import { AlertTable } from "@/components/alerts/alert-table";
import { getAlertStats } from "@/app/actions/alerts";

interface SearchParams {
  page?: string;
  severity?: string;
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect("/login");

  const page = parseInt(params.page || "1", 10);
  const perPage = 25;
  const offset = (page - 1) * perPage;

  // Get alert stats
  const stats = await getAlertStats(orgId);

  // Build conditions
  const conditions: ReturnType<typeof eq>[] = [eq(alerts.orgId, orgId)];

  if (params.severity) {
    const sev = params.severity as "critical" | "high" | "medium" | "low";
    conditions.push(eq(alerts.severity, sev));
  }
  if (params.type) {
    conditions.push(eq(alerts.alertType, params.type));
  }
  if (params.status) {
    const st = params.status === "acknowledged" ? "acknowledged" : "open";
    conditions.push(eq(alerts.status, st));
  }
  if (params.startDate) {
    conditions.push(gte(alerts.createdAt, new Date(params.startDate)));
  }
  if (params.endDate) {
    conditions.push(lte(alerts.createdAt, new Date(params.endDate + "T23:59:59")));
  }

  // Get total
  const [totalResult] = await db
    .select({ value: count() })
    .from(alerts)
    .where(and(...conditions));
  const total = totalResult?.value ?? 0;

  // Get alerts with joins
  const alertRows = await db
    .select({
      id: alerts.id,
      alertType: alerts.alertType,
      severity: alerts.severity,
      title: alerts.title,
      message: alerts.message,
      status: alerts.status,
      loadId: alerts.loadId,
      carrierId: alerts.carrierId,
      createdAt: alerts.createdAt,
      loadReference: loads.referenceNumber,
      carrierName: carriers.legalName,
    })
    .from(alerts)
    .leftJoin(loads, eq(alerts.loadId, loads.id))
    .leftJoin(carriers, eq(alerts.carrierId, carriers.id))
    .where(and(...conditions))
    .orderBy(desc(alerts.createdAt))
    .limit(perPage)
    .offset(offset);

  const totalPages = Math.ceil(total / perPage);

  const serialized = alertRows.map((a) => ({
    ...a,
    createdAt: a.createdAt?.toISOString() ?? null,
    loadReference: a.loadReference ?? null,
    carrierName: a.carrierName ?? null,
  }));

  const alertTypes = [
    { value: "carrier_substitution", label: "Carrier Substitution" },
    { value: "domain_mismatch", label: "Domain Mismatch" },
    { value: "off_location_pickup", label: "Off-Location Pickup" },
    { value: "failed_verification", label: "Failed Verification" },
    { value: "document_expiration", label: "Document Expiration" },
    { value: "fmcsa_status_change", label: "FMCSA Status Change" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Alerts</h2>
        <p className="text-muted-foreground">Security alerts and verification warnings.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className={stats.critical > 0 ? "border-red-500/50" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
              </div>
              <ShieldAlert className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High</p>
                <p className="text-2xl font-bold text-orange-600">{stats.high}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Medium</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.medium}</p>
              </div>
              <Bell className="h-8 w-8 text-yellow-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Acknowledged</p>
              <p className="text-2xl font-bold">{stats.acknowledged}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          defaultValue={params.severity || ""}
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          defaultValue={params.type || ""}
        >
          <option value="">All Types</option>
          {alertTypes.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          defaultValue={params.status || ""}
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="acknowledged">Acknowledged</option>
        </select>
      </div>

      <AlertTable alerts={serialized} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={"?page=" + (page - 1)}>
              <Button variant="outline" size="sm">Previous</Button>
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={"?page=" + (page + 1)}>
              <Button variant="outline" size="sm">Next</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
