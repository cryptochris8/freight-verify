import crypto from 'crypto';

export interface HashableEvent {
  loadId: string;
  eventType: string;
  actorId: string | null;
  actorType: string | null;
  description: string | null;
  metadata: unknown;
  geoLat: string | null;
  geoLng: string | null;
  createdAt: Date | string;
  prevHash: string | null;
  eventHash: string | null;
}

/**
 * Computes a SHA-256 hash of an event combined with the previous hash,
 * creating an append-only chain of custody.
 */
export function computeEventHash(
  event: Omit<HashableEvent, 'prevHash' | 'eventHash'>,
  prevHash: string | null
): string {
  const payload = JSON.stringify({
    loadId: event.loadId,
    eventType: event.eventType,
    actorId: event.actorId,
    actorType: event.actorType,
    description: event.description,
    metadata: event.metadata,
    geoLat: event.geoLat,
    geoLng: event.geoLng,
    createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : event.createdAt,
    prevHash: prevHash ?? 'GENESIS',
  });

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Verifies the integrity of an event chain by recomputing
 * each hash and comparing it to the stored hash.
 */
export function verifyChain(
  events: HashableEvent[]
): { valid: boolean; brokenAt: number | null } {
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const expectedPrevHash = i === 0 ? null : events[i - 1].eventHash;

    // Check prev_hash linkage
    if (event.prevHash !== expectedPrevHash && !(i === 0 && event.prevHash === null)) {
      return { valid: false, brokenAt: i };
    }

    // Recompute hash
    const computedHash = computeEventHash(
      {
        loadId: event.loadId,
        eventType: event.eventType,
        actorId: event.actorId,
        actorType: event.actorType,
        description: event.description,
        metadata: event.metadata,
        geoLat: event.geoLat,
        geoLng: event.geoLng,
        createdAt: event.createdAt,
      },
      expectedPrevHash
    );

    if (computedHash !== event.eventHash) {
      return { valid: false, brokenAt: i };
    }
  }

  return { valid: true, brokenAt: null };
}
