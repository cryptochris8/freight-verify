import { db } from "@/lib/db";
import { loads, carriers } from "@/lib/db/schema";
import { eq, desc, and, like, sql, gte, lte, count, inArray } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package, Truck, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { LoadsFilters } from "@/components/loads/loads-filters";

function getStatusVariant(status: string) {
  switch (status) {
    case "completed": case "delivered": return "default" as const;
    case "in_transit": case "accepted": return "secondary" as const;
    case "draft": case "tendered": return "outline" as const;
    case "cancelled": return "destructive" as const;
    default: return "secondary" as const;
  }
}

interface SearchParams {
  search?: string;
  status?: string;
  carrier?: string;
  page?: string;
  sort?: string;
  order?: string;
}

export default async function LoadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect("/login");

  const page = parseInt(sp.page || "1", 10);
  const perPage = 10;
  const offset = (page - 1) * perPage;

  // Build conditions
  const conditions = [eq(loads.orgId, orgId)];
  if (sp.search) conditions.push(like(loads.referenceNumber, "%" + sp.search + "%"));
  if (sp.status) {
    const statuses = sp.status.split(",").filter(Boolean);
    if (statuses.length > 0) conditions.push(inArray(loads.status, statuses as any));
  }
  if (sp.carrier) conditions.push(eq(loads.carrierId, sp.carrier));

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  // Get loads with carrier join
  const loadsList = await db
    .select({
      id: loads.id,
      referenceNumber: loads.referenceNumber,
      status: loads.status,
      originName: loads.originName,
      destinationName: loads.destinationName,
      pickupDate: loads.pickupDate,
      createdAt: loads.createdAt,
      carrierId: loads.carrierId,
      carrierName: carriers.legalName,
    })
    .from(loads)
    .leftJoin(carriers, eq(loads.carrierId, carriers.id))
    .where(whereClause)
    .orderBy(desc(loads.createdAt))
    .limit(perPage)
    .offset(offset);

  // Count totals
  const [totalResult] = await db.select({ value: count() }).from(loads).where(whereClause);
  const totalLoads = totalResult?.value ?? 0;
  const totalPages = Math.ceil(totalLoads / perPage);

  // Summary stats
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  const [activeCount] = await db.select({ value: count() }).from(loads).where(and(eq(loads.orgId, orgId), inArray(loads.status, ["draft", "tendered", "accepted", "in_transit", "delivered"])));
  const [inTransitCount] = await db.select({ value: count() }).from(loads).where(and(eq(loads.orgId, orgId), eq(loads.status, "in_transit")));
  const [pendingPickup] = await db.select({ value: count() }).from(loads).where(and(eq(loads.orgId, orgId), eq(loads.status, "accepted")));
  const [deliveredWeek] = await db.select({ value: count() }).from(loads).where(and(eq(loads.orgId, orgId), eq(loads.status, "delivered"), gte(loads.updatedAt, weekStart), lte(loads.updatedAt, weekEnd)));

  // Get verified carriers for filter
  const verifiedCarriers = await db.select({ id: carriers.id, legalName: carriers.legalName }).from(carriers).where(and(eq(carriers.orgId, orgId), eq(carriers.status, "verified")));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Loads</h2>
          <p className="text-muted-foreground">Track loads and chain-of-custody verification.</p>
        </div>
        <Link href="/loads/new">
          <Button><Plus className="mr-2 h-4 w-4" /> Create Load</Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Active</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{activeCount?.value ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{inTransitCount?.value ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Pickup</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{pendingPickup?.value ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered This Week</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{deliveredWeek?.value ?? 0}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <LoadsFilters carriers={verifiedCarriers} currentSearch={sp.search} currentStatus={sp.status} currentCarrier={sp.carrier} />

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Pickup Date</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadsList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No loads found. Create your first load to get started.</TableCell>
              </TableRow>
            ) : (
              loadsList.map((load) => (
                <TableRow key={load.id}>
                  <TableCell className="font-medium">
                    <Link href={"/loads/" + load.id} className="hover:underline">{load.referenceNumber || "N/A"}</Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(load.status || "draft")}>{(load.status || "draft").replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>{load.carrierName || "Unassigned"}</TableCell>
                  <TableCell className="text-sm">{(load.originName || "?") + " -> " + (load.destinationName || "?")}</TableCell>
                  <TableCell>{load.pickupDate ? format(new Date(load.pickupDate), "MMM d, yyyy") : "TBD"}</TableCell>
                  <TableCell>{load.createdAt ? format(new Date(load.createdAt), "MMM d, yyyy") : ""}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (() => {
        const buildPageUrl = (p: number) => {
          const params = new URLSearchParams();
          params.set("page", String(p));
          if (sp.search) params.set("search", sp.search);
          if (sp.status) params.set("status", sp.status);
          if (sp.carrier) params.set("carrier", sp.carrier);
          return "?" + params.toString();
        };
        return (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Showing {offset + 1} to {Math.min(offset + perPage, totalLoads)} of {totalLoads} loads</p>
            <div className="flex gap-2">
              {page > 1 && <Link href={buildPageUrl(page - 1)}><Button variant="outline" size="sm">Previous</Button></Link>}
              {page < totalPages && <Link href={buildPageUrl(page + 1)}><Button variant="outline" size="sm">Next</Button></Link>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
