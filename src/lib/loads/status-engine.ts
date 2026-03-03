import { db } from "@/lib/db";
import { loads, loadEvents } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { computeEventHash } from "@/lib/events/hash-chain";

export type LoadStatus = "draft" | "tendered" | "accepted" | "in_transit" | "delivered" | "completed" | "cancelled";

const VALID_TRANSITIONS: Record<LoadStatus, LoadStatus[]> = {
  draft: ["tendered", "cancelled"],
  tendered: ["accepted", "draft", "cancelled"],
  accepted: ["in_transit", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  delivered: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const TRANSITION_REQUIREMENTS: Partial<Record<string, (load: typeof loads.$inferSelect) => string | null>> = {
  "draft->tendered": (load) => {
    if (!load.carrierId) return "Cannot tender: no carrier assigned";
    return null;
  },
};

export interface TransitionResult {
  success: boolean;
  error?: string;
  load?: typeof loads.$inferSelect;
  event?: typeof loadEvents.$inferSelect;
}

export function isValidTransition(from: LoadStatus, to: LoadStatus): boolean {
  if (to === "cancelled") return from !== "completed" && from !== "cancelled";
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAvailableTransitions(status: LoadStatus): LoadStatus[] {
  const transitions = [...(VALID_TRANSITIONS[status] || [])];
  if (status !== "completed" && status !== "cancelled" && !transitions.includes("cancelled")) {
    transitions.push("cancelled");
  }
  return transitions;
}

export async function transitionStatus(
  loadId: string,
  newStatus: LoadStatus,
  actorId: string | null,
  orgId: string,
  metadata?: Record<string, unknown>
): Promise<TransitionResult> {
  const [load] = await db.select().from(loads).where(eq(loads.id, loadId)).limit(1);
  if (!load) return { success: false, error: "Load not found" };

  const currentStatus = load.status as LoadStatus;

  if (!isValidTransition(currentStatus, newStatus)) {
    return { success: false, error: `Invalid transition from ${currentStatus} to ${newStatus}` };
  }

  const requirementKey = `${currentStatus}->${newStatus}`;
  const requirementCheck = TRANSITION_REQUIREMENTS[requirementKey];
  if (requirementCheck) {
    const error = requirementCheck(load);
    if (error) return { success: false, error };
  }

  const [lastEvent] = await db
    .select()
    .from(loadEvents)
    .where(eq(loadEvents.loadId, loadId))
    .orderBy(desc(loadEvents.id))
    .limit(1);

  const prevHash = lastEvent?.eventHash ?? null;
  const now = new Date();

  const eventData = {
    loadId,
    eventType: `status_change:${currentStatus}->${newStatus}`,
    actorId,
    actorType: actorId ? ("user" as const) : ("system" as const),
    description: `Status changed from ${currentStatus} to ${newStatus}`,
    metadata: { fromStatus: currentStatus, toStatus: newStatus, ...metadata },
    geoLat: null,
    geoLng: null,
    createdAt: now,
  };

  const eventHash = computeEventHash(eventData, prevHash);

  const [updatedLoad] = await db
    .update(loads)
    .set({ status: newStatus, updatedAt: now })
    .where(eq(loads.id, loadId))
    .returning();

  const [event] = await db
    .insert(loadEvents)
    .values({
      loadId,
      orgId,
      eventType: eventData.eventType,
      actorId: eventData.actorId,
      actorType: eventData.actorType,
      description: eventData.description,
      metadata: eventData.metadata,
      prevHash,
      eventHash,
      createdAt: now,
    })
    .returning();

  return { success: true, load: updatedLoad, event };
}
