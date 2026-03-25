import { db } from "@/lib/db";
import { loads, carriers, alerts, loadEvents, pickupVerifications } from "@/lib/db/schema";
import { eq, count, and, asc, desc, lte, gte, inArray, lt, sql } from "drizzle-orm";
import { resolveOrgId } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Package, ShieldCheck, AlertTriangle, Clock, ArrowRight, CheckCircle2, TrendingUp, Activity } from "lucide-react";
import Link from "next/link";
import { format, startOfWeek, endOfWeek, subHours, subDays, startOfDay, startOfMonth } from "date-fns";
import { getAlertStats } from "@/app/actions/alerts";
import { AlertSummary } from "@/components/alerts/alert-summary";
import { getLoadStatusVariant } from "@/lib/utils/status-variant";

export default async function DashboardPage() {
  const { userId, orgId } = await resolveOrgId();

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const monthStart = startOfMonth(now);
  const twentyFourHoursAgo = subHours(now, 24);

  const [activeLoads] = await db.select({ value: count() }).from(loads).where(and(eq(loads.orgId, orgId), inArray(loads.status, ["draft", "tendered", "accepted", "in_transit", "delivered"])));
  const [awaitingPickup] = await db.select({ value: count() }).from(loads).where(and(eq(loads.orgId, orgId), eq(loads.status, "accepted")));
  const [inTransit] = await db.select({ value: count() }).from(loads).where(and(eq(loads.orgId, orgId), eq(loads.status, "in_transit")));
  const [deliveredWeek] = await db.select({ value: count() }).from(loads).where(and(eq(loads.orgId, orgId), eq(loads.status, "delivered"), gte(loads.updatedAt, weekStart), lte(loads.updatedAt, weekEnd)));

  // Performance metrics
  const [completedThisMonth] = await db.select({ value: count() }).from(loads).where(and(eq(loads.orgId, orgId), inArray(loads.status, ["delivered", "completed"]), gte(loads.updatedAt, monthStart)));
  const [totalVerifications] = await db.select({ value: count() }).from(pickupVerifications).where(eq(pickupVerifications.orgId, orgId));
  const [successfulVerifications] = await db.select({ value: count() }).from(pickupVerifications).where(and(eq(pickupVerifications.orgId, orgId), eq(pickupVerifications.verificationStatus, "verified")));
  const verificationRate = (totalVerifications?.value ?? 0) > 0 ? Math.round(((successfulVerifications?.value ?? 0) / (totalVerifications?.value ?? 1)) * 100) : 0;

  const upcomingPickups = await db
    .select({ id: loads.id, referenceNumber: loads.referenceNumber, originName: loads.originName, destinationName: loads.destinationName, pickupDate: loads.pickupDate, status: loads.status, carrierName: carriers.legalName })
    .from(loads).leftJoin(carriers, eq(loads.carrierId, carriers.id))
    .where(and(eq(loads.orgId, orgId), inArray(loads.status, ["accepted", "tendered"]), gte(loads.pickupDate, now)))
    .orderBy(asc(loads.pickupDate)).limit(5);

  const needsAttention = await db
    .select({ id: loads.id, referenceNumber: loads.referenceNumber, status: loads.status, createdAt: loads.createdAt, carrierName: carriers.legalName })
    .from(loads).leftJoin(carriers, eq(loads.carrierId, carriers.id))
    .where(and(eq(loads.orgId, orgId), eq(loads.status, "tendered"), lt(loads.updatedAt, twentyFourHoursAgo)))
    .limit(10);

  const alertStats = await getAlertStats(orgId);

  const recentAlerts = await db
    .select({ id: alerts.id, alertType: alerts.alertType, severity: alerts.severity, title: alerts.title, message: alerts.message, createdAt: alerts.createdAt })
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), eq(alerts.status, "open")))
    .orderBy(desc(alerts.createdAt))
    .limit(3);

  // Single query with GROUP BY replaces 21 serial queries (3 per day × 7 days)
  const sevenDaysAgo = startOfDay(subDays(now, 6));
  const trendRows = await db
    .select({
      day: sql<string>`date_trunc('day', ${alerts.createdAt})::date::text`,
      severity: alerts.severity,
      value: count(),
    })
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), gte(alerts.createdAt, sevenDaysAgo)))
    .groupBy(sql`date_trunc('day', ${alerts.createdAt})`, alerts.severity);

  // Build a map from the grouped results
  const trendMap = new Map<string, { critical: number; high: number; medium: number }>();
  for (const row of trendRows) {
    if (!row.day) continue;
    const key = row.day;
    if (!trendMap.has(key)) trendMap.set(key, { critical: 0, high: 0, medium: 0 });
    const entry = trendMap.get(key)!;
    if (row.severity === "critical") entry.critical = row.value;
    else if (row.severity === "high") entry.high = row.value;
    else if (row.severity === "medium") entry.medium = row.value;
  }

  const trendData: { date: string; critical: number; high: number; medium: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = startOfDay(subDays(now, i));
    const key = format(dayStart, "yyyy-MM-dd");
    const entry = trendMap.get(key) ?? { critical: 0, high: 0, medium: 0 };
    trendData.push({ date: format(dayStart, "MMM d"), ...entry });
  }

  const stats = [
    { title: "Active Loads", value: String(activeLoads?.value ?? 0), description: "Not completed or cancelled", icon: Package },
    { title: "Awaiting Pickup", value: String(awaitingPickup?.value ?? 0), description: "Accepted, pending pickup", icon: Clock },
    { title: "In Transit", value: String(inTransit?.value ?? 0), description: "Currently moving", icon: Truck },
    { title: "Delivered This Week", value: String(deliveredWeek?.value ?? 0), description: "Deliveries this week", icon: ShieldCheck },
  ];

  const performanceStats = [
    { title: "Completed This Month", value: String(completedThisMonth?.value ?? 0), description: "Loads delivered this month", icon: CheckCircle2 },
    { title: "Verification Rate", value: verificationRate + "%", description: "Successful pickup verifications", icon: TrendingUp },
    { title: "Total Verifications", value: String(totalVerifications?.value ?? 0), description: "All-time pickup verifications", icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your freight verification operations.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Metrics */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Performance Metrics</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {performanceStats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Alert Summary */}
      <AlertSummary
        stats={alertStats}
        recentAlerts={recentAlerts.map((a) => ({ ...a, createdAt: a.createdAt?.toISOString() ?? null }))}
        trendData={trendData}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Upcoming Pickups</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingPickups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming pickups</p>
            ) : (
              <div className="space-y-3">
                {upcomingPickups.map((load) => (
                  <Link key={load.id} href={"/loads/" + load.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{load.referenceNumber}</p>
                        <Badge variant={getLoadStatusVariant(load.status || "draft")} className="text-xs">{(load.status || "draft").replace("_", " ")}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{load.originName} <ArrowRight className="h-3 w-3 inline" /> {load.destinationName}</p>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-sm font-medium">{load.pickupDate ? format(new Date(load.pickupDate), "MMM d") : "TBD"}</p>
                      <p className="text-xs text-muted-foreground">{load.carrierName || "No carrier"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Needs Attention</CardTitle>
          </CardHeader>
          <CardContent>
            {needsAttention.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No loads needing attention</p>
            ) : (
              <div className="space-y-3">
                {needsAttention.map((load) => (
                  <Link key={load.id} href={"/loads/" + load.id} className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-colors dark:border-amber-900 dark:bg-amber-950/20">
                    <div>
                      <p className="text-sm font-medium">{load.referenceNumber}</p>
                      <p className="text-xs text-muted-foreground">Tendered to {load.carrierName || "carrier"} - no response for 24h+</p>
                    </div>
                    <Badge variant="outline" className="text-amber-600">Awaiting</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
