import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

let selectCallCount = 0;
let selectResults: unknown[][] = [];

const mockDeleteFn = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined),
});

const mockUpdateFn = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

vi.mock("@/lib/db", () => {
  const createChainedMock = () => {
    const mock: Record<string, unknown> = {};
    mock.from = vi.fn().mockReturnValue(mock);
    mock.where = vi.fn().mockReturnValue(mock);
    mock.limit = vi.fn().mockImplementation(() => {
      const result = selectResults[selectCallCount] ?? [];
      selectCallCount++;
      return Promise.resolve(result);
    });
    return mock;
  };

  return {
    db: {
      select: vi.fn().mockImplementation(() => createChainedMock()),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      })),
      update: mockUpdateFn,
      delete: mockDeleteFn,
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  loads: {},
  organizations: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock("@/lib/validation/schemas", () => ({
  loadUpdateSchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, resetAt: new Date() }),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/events/create-event", () => ({
  createChainedEvent: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { auth } from "@clerk/nextjs/server";
import { loadUpdateSchema } from "@/lib/validation/schemas";

const mockOrg = { id: "org-uuid-1", clerkOrgId: "org_clerk_123" };
const mockDraftLoad = {
  id: "load-1",
  orgId: "org-uuid-1",
  referenceNumber: "LD-001",
  status: "draft",
};
const mockInTransitLoad = {
  id: "load-2",
  orgId: "org-uuid-1",
  referenceNumber: "LD-002",
  status: "in_transit",
};
const mockCancelledLoad = {
  id: "load-3",
  orgId: "org-uuid-1",
  referenceNumber: "LD-003",
  status: "cancelled",
};

describe("loads/[id] API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectResults = [];
  });

  describe("PATCH", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: null, userId: null } as never);

      const { PATCH } = await import("@/app/api/loads/[id]/route");
      const req = new Request("http://localhost/api/loads/load-1", {
        method: "PATCH",
        body: JSON.stringify({ commodity: "Steel" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "load-1" }) });
      expect(res.status).toBe(401);
    });

    it("returns 409 when load is not in draft status", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "user_123", orgId: "org_clerk_123",
      } as never);
      selectResults = [[mockOrg], [mockInTransitLoad]];

      const { PATCH } = await import("@/app/api/loads/[id]/route");
      const req = new Request("http://localhost/api/loads/load-2", {
        method: "PATCH",
        body: JSON.stringify({ commodity: "Steel" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "load-2" }) });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe("Only draft loads can be edited");
    });

    it("returns 400 on validation failure", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "user_123", orgId: "org_clerk_123",
      } as never);
      selectResults = [[mockOrg], [mockDraftLoad]];

      vi.mocked(loadUpdateSchema.safeParse).mockReturnValueOnce({
        success: false,
        error: { flatten: () => ({ fieldErrors: { weightLbs: ["Must be positive"] } }) },
      } as never);

      const { PATCH } = await import("@/app/api/loads/[id]/route");
      const req = new Request("http://localhost/api/loads/load-1", {
        method: "PATCH",
        body: JSON.stringify({ weightLbs: "-5" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "load-1" }) });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE", () => {
    it("returns 403 when user is not admin", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "user_123", orgId: "org_clerk_123", orgRole: "org:member",
      } as never);

      const { DELETE } = await import("@/app/api/loads/[id]/route");
      const req = new Request("http://localhost/api/loads/load-1", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ id: "load-1" }) });
      expect(res.status).toBe(403);
    });

    it("returns 409 when load is in_transit", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "user_123", orgId: "org_clerk_123", orgRole: "org:admin",
      } as never);
      selectResults = [[mockOrg], [mockInTransitLoad]];

      const { DELETE } = await import("@/app/api/loads/[id]/route");
      const req = new Request("http://localhost/api/loads/load-2", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ id: "load-2" }) });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe("Only draft or cancelled loads can be deleted");
    });

    it("returns 204 on successful delete of draft load", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "user_123", orgId: "org_clerk_123", orgRole: "org:admin",
      } as never);
      selectResults = [[mockOrg], [mockDraftLoad]];

      const { DELETE } = await import("@/app/api/loads/[id]/route");
      const req = new Request("http://localhost/api/loads/load-1", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ id: "load-1" }) });
      expect(res.status).toBe(204);
    });

    it("returns 204 on successful delete of cancelled load", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "user_123", orgId: "org_clerk_123", orgRole: "org:admin",
      } as never);
      selectResults = [[mockOrg], [mockCancelledLoad]];

      const { DELETE } = await import("@/app/api/loads/[id]/route");
      const req = new Request("http://localhost/api/loads/load-3", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ id: "load-3" }) });
      expect(res.status).toBe(204);
    });
  });
});
