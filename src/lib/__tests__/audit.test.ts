import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing the module under test
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  auditLog: {},
}));

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";

describe("writeAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts an audit log entry with the correct values", async () => {
    const entry = {
      orgId: "org-1",
      entityType: "carrier",
      entityId: "carrier-1",
      action: "carrier_created",
      actorId: "user-1",
      actorType: "user" as const,
      metadata: { dotNumber: "123456" },
      ipAddress: "127.0.0.1",
    };

    await writeAuditLog(entry);

    expect(db.insert).toHaveBeenCalledOnce();
    const valuesCall = vi.mocked(db.insert("" as never).values);
    expect(valuesCall).toHaveBeenCalledWith({
      orgId: "org-1",
      entityType: "carrier",
      entityId: "carrier-1",
      action: "carrier_created",
      actorId: "user-1",
      actorType: "user",
      metadata: { dotNumber: "123456" },
      ipAddress: "127.0.0.1",
    });
  });

  it("defaults metadata and ipAddress to null when not provided", async () => {
    const entry = {
      orgId: "org-1",
      entityType: "load",
      entityId: "load-1",
      action: "load_created",
      actorId: "user-1",
      actorType: "system" as const,
    };

    await writeAuditLog(entry);

    const valuesCall = vi.mocked(db.insert("" as never).values);
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: null,
        ipAddress: null,
      })
    );
  });

  it("does not throw when the database insert fails", async () => {
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockRejectedValueOnce(new Error("DB connection failed")),
    } as never);

    await expect(
      writeAuditLog({
        orgId: "org-1",
        entityType: "carrier",
        entityId: "carrier-1",
        action: "test",
        actorId: "user-1",
        actorType: "user",
      })
    ).resolves.not.toThrow();
  });
});
