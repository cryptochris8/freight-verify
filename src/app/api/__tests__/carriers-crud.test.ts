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
  carriers: {},
  organizations: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock("@/lib/validation/schemas", () => ({
  carrierUpdateSchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, resetAt: new Date() }),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg = "Admin access required") { super(msg); this.name = "ForbiddenError"; }
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { auth } from "@clerk/nextjs/server";
import { carrierUpdateSchema } from "@/lib/validation/schemas";

const mockOrg = { id: "org-uuid-1", clerkOrgId: "org_clerk_123" };
const mockCarrier = {
  id: "carrier-1",
  orgId: "org-uuid-1",
  dotNumber: "123456",
  legalName: "Test Trucking",
  status: "pending",
};

describe("carriers/[id] API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectResults = [];
  });

  describe("PATCH", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValueOnce({ orgId: null, userId: null } as never);

      const { PATCH } = await import("@/app/api/carriers/[id]/route");
      const req = new Request("http://localhost/api/carriers/carrier-1", {
        method: "PATCH",
        body: JSON.stringify({ legalName: "Updated" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "carrier-1" }) });
      expect(res.status).toBe(401);
    });

    it("returns 404 when carrier not found", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "user_123", orgId: "org_clerk_123",
      } as never);
      selectResults = [[mockOrg], []]; // org found, carrier not found

      const { PATCH } = await import("@/app/api/carriers/[id]/route");
      const req = new Request("http://localhost/api/carriers/carrier-1", {
        method: "PATCH",
        body: JSON.stringify({ legalName: "Updated" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "carrier-1" }) });
      expect(res.status).toBe(404);
    });

    it("returns 400 on validation failure", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "user_123", orgId: "org_clerk_123",
      } as never);
      selectResults = [[mockOrg], [mockCarrier]];

      vi.mocked(carrierUpdateSchema.safeParse).mockReturnValueOnce({
        success: false,
        error: { flatten: () => ({ fieldErrors: { email: ["Invalid"] } }) },
      } as never);

      const { PATCH } = await import("@/app/api/carriers/[id]/route");
      const req = new Request("http://localhost/api/carriers/carrier-1", {
        method: "PATCH",
        body: JSON.stringify({ email: "bad" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "carrier-1" }) });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE", () => {
    it("returns 403 when user is not admin", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "user_123", orgId: "org_clerk_123", orgRole: "org:member",
      } as never);

      const { DELETE } = await import("@/app/api/carriers/[id]/route");
      const req = new Request("http://localhost/api/carriers/carrier-1", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ id: "carrier-1" }) });
      expect(res.status).toBe(403);
    });

    it("returns 404 when carrier not found", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "user_123", orgId: "org_clerk_123", orgRole: "org:admin",
      } as never);
      selectResults = [[mockOrg], []]; // org found, carrier not found

      const { DELETE } = await import("@/app/api/carriers/[id]/route");
      const req = new Request("http://localhost/api/carriers/carrier-1", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ id: "carrier-1" }) });
      expect(res.status).toBe(404);
    });

    it("returns 204 on successful delete", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: "user_123", orgId: "org_clerk_123", orgRole: "org:admin",
      } as never);
      selectResults = [[mockOrg], [mockCarrier]];

      const { DELETE } = await import("@/app/api/carriers/[id]/route");
      const req = new Request("http://localhost/api/carriers/carrier-1", { method: "DELETE" });
      const res = await DELETE(req, { params: Promise.resolve({ id: "carrier-1" }) });
      expect(res.status).toBe(204);
    });
  });
});
