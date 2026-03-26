import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// Mock dependencies
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

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
      return Promise.resolve(result);
    });
    return mock;
  };

  return {
    db: {
      select: vi.fn().mockImplementation(() => createChainedMock()),
    },
  };
});

vi.mock("@/lib/db/schema", () => ({
  organizations: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";

describe("withAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectResults = [];
  });

  async function getModule() {
    return await import("@/lib/auth");
  }

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      userId: null,
      orgId: null,
    } as never);

    const { withAuth } = await getModule();
    const handler = vi.fn();
    const wrapped = withAuth(handler);

    const request = new Request("http://localhost/api/test");
    const response = await wrapped(request);

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when orgId is missing", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      userId: "user-1",
      orgId: null,
    } as never);

    const { withAuth } = await getModule();
    const handler = vi.fn();
    const wrapped = withAuth(handler);

    const request = new Request("http://localhost/api/test");
    const response = await wrapped(request);

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 404 when org is not found in database", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      userId: "user-1",
      orgId: "org_clerk_123",
    } as never);

    selectResults = [[]]; // org lookup returns empty

    const { withAuth } = await getModule();
    const handler = vi.fn();
    const wrapped = withAuth(handler);

    const request = new Request("http://localhost/api/test");
    const response = await wrapped(request);

    expect(response.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler with auth context when authenticated", async () => {
    const mockOrg = { id: "org-uuid-1", clerkOrgId: "org_clerk_123", name: "Test" };

    vi.mocked(auth).mockResolvedValueOnce({
      userId: "user-1",
      orgId: "org_clerk_123",
    } as never);

    selectResults = [[mockOrg]];

    const { withAuth } = await getModule();
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ ok: true })
    );
    const wrapped = withAuth(handler);

    const request = new Request("http://localhost/api/test");
    await wrapped(request);

    expect(handler).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        userId: "user-1",
        orgId: "org-uuid-1",
        org: mockOrg,
      })
    );
  });

  it("returns handler response on success", async () => {
    const mockOrg = { id: "org-uuid-1", clerkOrgId: "org_clerk_123", name: "Test" };

    vi.mocked(auth).mockResolvedValueOnce({
      userId: "user-1",
      orgId: "org_clerk_123",
    } as never);

    selectResults = [[mockOrg]];

    const { withAuth } = await getModule();
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ items: [1, 2, 3] })
    );
    const wrapped = withAuth(handler);

    const request = new Request("http://localhost/api/test");
    const response = await wrapped(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toEqual([1, 2, 3]);
  });
});

describe("withAdminAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
    selectResults = [];
  });

  async function getModule() {
    return await import("@/lib/auth");
  }

  it("returns 403 when user is not admin", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      userId: "user-1",
      orgId: "org_clerk_123",
      orgRole: "org:member",
    } as never);

    const { withAdminAuth } = await getModule();
    const handler = vi.fn();
    const wrapped = withAdminAuth(handler);

    const request = new Request("http://localhost/api/test");
    const response = await wrapped(request);

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when user is admin", async () => {
    const mockOrg = { id: "org-uuid-1", clerkOrgId: "org_clerk_123", name: "Test" };

    vi.mocked(auth).mockResolvedValueOnce({
      userId: "user-1",
      orgId: "org_clerk_123",
      orgRole: "org:admin",
    } as never);

    selectResults = [[mockOrg]];

    const { withAdminAuth } = await getModule();
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ ok: true })
    );
    const wrapped = withAdminAuth(handler);

    const request = new Request("http://localhost/api/test");
    await wrapped(request);

    expect(handler).toHaveBeenCalled();
  });
});
