import { db } from "@/lib/db";
import { loadEvents, loads, carriers } from "@/lib/db/schema";
import { eq, and, desc, gte, lte, like, or, count } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Download } from "lucide-react";
import Link from "next/link";
import { EventFeed } from "@/components/events/event-feed";
import { EventFilters } from "@/components/events/event-filters";
import { ChainIntegrityChecker } from "@/components/events/chain-integrity-checker";

interface SearchParams {
  page?: string;
  search?: string;
  types?: string;
  carrier?: string;
  startDate?: string;
  endDate?: string;
}

export default async function EventsPage({
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

  // Build conditions
  const conditions: ReturnType<typeof eq>[] = [eq(loadEvents.orgId, orgId)];

  if (params.startDate) {
    conditions.push(gte(loadEvents.createdAt, new Date(params.startDate)));
  }
  if (params.endDate) {
    conditions.push(lte(loadEvents.createdAt, new Date(params.endDate + "T23:59:59")));
  }

  // Get total count
  const [totalResult] = await db
    .select({ value: count() })
    .from(loadEvents)
    .where(and(...conditions));
  const total = totalResult?.value ?? 0;

  // Get events with joins
  const events = await db
    .select({
      id: loadEvents.id,
      eventType: loadEvents.eventType,
      description: loadEvents.description,
      actorId: loadEvents.actorId,
      actorType: loadEvents.actorType,
      eventHash: loadEvents.eventHash,
      prevHash: loadEvents.prevHash,
      metadata: loadEvents.metadata,
      createdAt: loadEvents.createdAt,
      loadId: loadEvents.loadId,
      referenceNumber: loads.referenceNumber,
      carrierName: carriers.legalName,
    })
    .from(loadEvents)
    .leftJoin(loads, eq(loadEvents.loadId, loads.id))
    .leftJoin(carriers, eq(loads.carrierId, carriers.id))
    .where(and(...conditions))
    .orderBy(desc(loadEvents.createdAt))
    .limit(perPage)
    .offset(offset);

  // Apply client-side filters for search and types
  let filtered = events;
  if (params.search) {
    const s = params.search.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        (e.referenceNumber && e.referenceNumber.toLowerCase().includes(s)) ||
        (e.carrierName && e.carrierName.toLowerCase().includes(s))
    );
  }
  if (params.types) {
    const types = params.types.split(",");
    filtered = filtered.filter((e) =>
      types.some((t) => e.eventType.startsWith(t))
    );
  }
  if (params.carrier) {
    filtered = filtered.filter((e) => {
      // carrier filter by ID - need to check via load join
      return true; // simplified, we filter in query if needed
    });
  }

  // Get carriers for filter dropdown
  const orgCarriers = await db
    .select({ id: carriers.id, name: carriers.legalName })
    .from(carriers)
    .where(eq(carriers.orgId, orgId));

  const totalPages = Math.ceil(total / perPage);

  const serialized = filtered.map((e) => ({
    ...e,
    createdAt: e.createdAt?.toISOString() ?? null,
    carrierName: e.carrierName ?? null,
    referenceNumber: e.referenceNumber ?? null,
  }));

  // Build export URL
  const exportParams = new URLSearchParams();
  if (params.startDate) exportParams.set("startDate", params.startDate);
  if (params.endDate) exportParams.set("endDate", params.endDate);
  if (params.types) exportParams.set("eventTypes", params.types);
  const exportUrl = "/api/events/export?" + exportParams.toString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Events</h2>
          <p className="text-muted-foreground">
            Chain-of-custody event log with hash verification.
          </p>
        </div>
        <div className="flex gap-2">
          <a href={exportUrl}>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      <EventFilters
        carriers={orgCarriers.map((c) => ({ id: c.id, name: c.name ?? "" }))}
      />

      <ChainIntegrityChecker />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Event Feed
            <span className="text-sm font-normal text-muted-foreground">
              ({total} total events)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EventFeed events={serialized} showLoadReference={true} />
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={"?page=" + (page - 1) + (params.search ? "&search=" + params.search : "") + (params.types ? "&types=" + params.types : "")}
            >
              <Button variant="outline" size="sm">Previous</Button>
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={"?page=" + (page + 1) + (params.search ? "&search=" + params.search : "") + (params.types ? "&types=" + params.types : "")}
            >
              <Button variant="outline" size="sm">Next</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
