import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

interface AuditEntry {
  orgId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorType: "user" | "carrier" | "driver" | "system";
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function writeAuditLog(entry: AuditEntry) {
  try {
    await db.insert(auditLog).values({
      orgId: entry.orgId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      actorId: entry.actorId,
      actorType: entry.actorType,
      metadata: entry.metadata ?? null,
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (err) {
    console.error("[AUDIT] Failed to write audit log:", err);
  }
}
