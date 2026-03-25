import { db } from "@/lib/db";
import { carriers } from "@/lib/db/schema";
import { eq, desc, count, and, or, like, ilike } from "drizzle-orm";
import { resolveOrgId } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { CarriersFilters } from "@/components/carriers/carriers-filters";

function getStatusVariant(status: string | null) {
  switch (status) {
    case "verified":
      return "default" as const;
    case "pending":
      return "secondary" as const;
    case "flagged":
    case "suspended":
      return "destructive" as const;
    case "expired":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

interface SearchParams {
  page?: string;
  search?: string;
  status?: string;
}

export default async function CarriersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { orgId } = await resolveOrgId();

  const page = parseInt(sp.page || "1", 10);
  const perPage = 20;
  const offset = (page - 1) * perPage;

  // Build conditions
  const conditions = [eq(carriers.orgId, orgId)];
  if (sp.search) {
    conditions.push(
      or(
        ilike(carriers.legalName, "%" + sp.search + "%"),
        ilike(carriers.dotNumber, "%" + sp.search + "%"),
        ilike(carriers.mcNumber, "%" + sp.search + "%"),
        ilike(carriers.dbaName, "%" + sp.search + "%"),
      )!,
    );
  }
  if (sp.status) {
    conditions.push(eq(carriers.status, sp.status as typeof carriers.status.enumValues[number]));
  }

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const carrierList = await db
    .select({
      id: carriers.id,
      legalName: carriers.legalName,
      dotNumber: carriers.dotNumber,
      mcNumber: carriers.mcNumber,
      status: carriers.status,
      fmcsaLastCheck: carriers.fmcsaLastCheck,
      fleetSize: carriers.fleetSize,
    })
    .from(carriers)
    .where(whereClause)
    .orderBy(desc(carriers.createdAt))
    .limit(perPage)
    .offset(offset);

  const [totalResult] = await db.select({ value: count() }).from(carriers).where(whereClause);
  const totalCarriers = totalResult?.value ?? 0;
  const totalPages = Math.ceil(totalCarriers / perPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Carriers</h2>
          <p className="text-muted-foreground">
            Manage and verify your carrier network.
          </p>
        </div>
        <Link href="/carriers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Carrier
          </Button>
        </Link>
      </div>

      <CarriersFilters currentSearch={sp.search} currentStatus={sp.status} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Legal Name</TableHead>
              <TableHead>DOT #</TableHead>
              <TableHead>MC #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Verified</TableHead>
              <TableHead className="text-right">Fleet Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carrierList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {sp.search || sp.status
                    ? "No carriers match your filters."
                    : "No carriers found. Add your first carrier to get started."}
                </TableCell>
              </TableRow>
            ) : (
              carrierList.map((carrier) => (
                <TableRow key={carrier.id}>
                  <TableCell className="font-medium">
                    <Link href={"/carriers/" + carrier.id} className="hover:underline">
                      {carrier.legalName || "Unknown"}
                    </Link>
                  </TableCell>
                  <TableCell>{carrier.dotNumber}</TableCell>
                  <TableCell>{carrier.mcNumber || "\u2014"}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(carrier.status)}>
                      {carrier.status || "pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {carrier.fmcsaLastCheck
                      ? format(new Date(carrier.fmcsaLastCheck), "MMM d, yyyy")
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">{carrier.fleetSize ?? "\u2014"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (() => {
        const buildPageUrl = (p: number) => {
          const params = new URLSearchParams();
          params.set("page", String(p));
          if (sp.search) params.set("search", sp.search);
          if (sp.status) params.set("status", sp.status);
          return "?" + params.toString();
        };
        return (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Showing {offset + 1} to {Math.min(offset + perPage, totalCarriers)} of {totalCarriers} carriers</p>
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
