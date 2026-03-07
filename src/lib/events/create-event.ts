import { db } from "@/lib/db";
import { loadEvents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { computeEventHash } from "./hash-chain";

export interface CreateEventInput {
  loadId: string;
  orgId: string;
  eventType: string;
  actorId: string | null;
  actorType: "user" | "carrier" | "driver" | "system";
  description: string;
  metadata?: Record<string, unknown>;
  geoLat?: string | null;
  geoLng?: string | null;
  ipAddress?: string | null;
}

/**
 * Creates a hash-chained event atomically using a database transaction.
 * This prevents race conditions where concurrent event creation could
 * break the hash chain.
 */
export async function createChainedEvent(input: CreateEventInput) {
  return await db.transaction(async (tx) => {
    const [lastEvent] = await tx
      .select({ eventHash: loadEvents.eventHash })
      .from(loadEvents)
      .where(eq(loadEvents.loadId, input.loadId))
      .orderBy(desc(loadEvents.id))
      .limit(1);

    const prevHash = lastEvent?.eventHash ?? null;
    const now = new Date();

    const eventData = {
      loadId: input.loadId,
      eventType: input.eventType,
      actorId: input.actorId,
      actorType: input.actorType,
      description: input.description,
      metadata: input.metadata ?? {},
      geoLat: input.geoLat ?? null,
      geoLng: input.geoLng ?? null,
      createdAt: now,
    };

    const eventHash = computeEventHash(eventData, prevHash);

    const [event] = await tx.insert(loadEvents).values({
      loadId: input.loadId,
      orgId: input.orgId,
      eventType: input.eventType,
      actorId: input.actorId,
      actorType: input.actorType,
      description: input.description,
      metadata: input.metadata ?? {},
      geoLat: input.geoLat,
      geoLng: input.geoLng,
      ipAddress: input.ipAddress,
      prevHash,
      eventHash,
      createdAt: now,
    }).returning();

    return event;
  });
}
