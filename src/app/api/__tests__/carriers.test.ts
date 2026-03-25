import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

// Track mock calls with a counter to return different values on sequential calls
let selectCallCount = 0;
let selectResults: unknown[][] = [];

vi.mock("@/lib/db", () => {
  const createChainedMock = () => {
    const mock: Record<string, unknown> = {};
    mock.from = vi.fn().mockReturnValue(mock);
    mock.where = vi.fn().mockReturnValue(mock);
    mock.limit = vi.fn().mockImplementation(() => {
      const result = selectResults[selectCallCount] ?? [];
      selectCallCount++;
      // Return an object that is both thenable (for queries without offset)
      // and chainable (for queries with offset)
      return {
        offset: vi.fn().mockImplementation(() => {
          // offset() consumes the next selectResults entry
          const offsetResult = selectResults[selectCallCount] ?? result;
          selectCallCount++;
          return Promise.resolve(offsetResult);
        }),
        then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
      };
    });
    mock.offset = vi.fn().mockImplementation(() => {
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
        values: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "new-carrier-1" }]),
        })),
      })),
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  carriers: {},
  organizations: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  count: vi.fn().mockReturnValue("count"),
}));

vi.mock("@/lib/validation/schemas", () => ({
  carrierCreateSchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, resetAt: new Date() }),
}));

vi.mock("@/lib/billing/feature-gate", () => ({
  checkAccess: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { auth } from "@clerk/nextjs/server";
import { carrierCreateSchema } from "@/lib/validation/schemas";

const mockOrg = { id: "org-uuid-1", clerkOrgId: "org_clerk_123", name: "Test Org" };

describe("carriers API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectResults = [];
  });

  describe("auth checks", () => {
    it("returns 401 when user is not authenticated for GET", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        orgId: null,
        userId: null,
      } as never);

      const { GET } = await import("@/app/api/carriers/route");
      const request = new Request("http://localhost:3000/api/carriers");
      const response = await GET(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when user is not authenticated for POST", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        orgId: null,
        userId: null,
      } as never);

      const { POST } = await import("@/app/api/carriers/route");
      const request = new Request("http://localhost:3000/api/carriers", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("returns 404 when organization is not found for POST", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        orgId: "org_clerk_123",
        userId: "user_123",
      } as never);

      // Org lookup returns empty
      selectResults = [[]];

      const { POST } = await import("@/app/api/carriers/route");
      const request = new Request("http://localhost:3000/api/carriers", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });
      const response = await POST(request);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe("Organization not found");
    });
  });

  describe("happy paths", () => {
    it("GET passes auth and calls db.select for carrier list", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        orgId: "org_clerk_123",
        userId: "user_123",
      } as never);

      // withAuth org lookup succeeds
      selectResults = [[mockOrg]];

      const { GET } = await import("@/app/api/carriers/route");
      const { db } = await import("@/lib/db");
      const request = new Request("http://localhost:3000/api/carriers?page=1&limit=20");
      await GET(request);

      // Verify that db.select was called (auth passed, query attempted)
      expect(db.select).toHaveBeenCalled();
    });

    it("POST creates a carrier successfully", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        orgId: "org_clerk_123",
        userId: "user_123",
      } as never);

      // Org lookup succeeds
      selectResults = [[mockOrg]];

      vi.mocked(carrierCreateSchema.safeParse).mockReturnValueOnce({
        success: true,
        data: {
          dotNumber: "123456",
          mcNumber: "MC789",
          legalName: "Test Carrier Inc",
          email: "dispatch@testcarrier.com",
          phone: "555-1234",
        },
      } as never);

      const { POST } = await import("@/app/api/carriers/route");
      const request = new Request("http://localhost:3000/api/carriers", {
        method: "POST",
        body: JSON.stringify({
          dotNumber: "123456",
          legalName: "Test Carrier Inc",
        }),
        headers: { "Content-Type": "application/json" },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.carrier).toBeDefined();
      expect(body.carrier.id).toBe("new-carrier-1");
    });
  });
});
