import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from "@/lib/db";

// We need to test the token extraction logic and the validation flow.
// Since the module does a DB lookup, we mock that.

describe("driver-token validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Import after mocks are set up
  async function getModule() {
    return await import("@/lib/auth/driver-token");
  }

  function mockRequest(headers: Record<string, string> = {}): Request {
    return new Request("http://localhost/api/test", {
      headers: new Headers(headers),
    });
  }

  function setupDbMock(result: unknown[] = []) {
    const limitFn = vi.fn().mockResolvedValue(result);
    const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: fromFn });
    return { fromFn, whereFn, limitFn };
  }

  it("returns null when no token header is provided", async () => {
    const { validateDriverToken } = await getModule();
    const req = mockRequest({});
    const result = await validateDriverToken(req);
    expect(result).toBeNull();
    expect(db.select).not.toHaveBeenCalled();
  });

  it("extracts token from Authorization Bearer header", async () => {
    const { validateDriverToken } = await getModule();
    const mockLoad = { id: "load-1", driverToken: "test-token-123" };
    setupDbMock([mockLoad]);

    const req = mockRequest({ authorization: "Bearer test-token-123" });
    const result = await validateDriverToken(req);
    expect(result).toEqual(mockLoad);
  });

  it("extracts token from x-driver-token header", async () => {
    const { validateDriverToken } = await getModule();
    const mockLoad = { id: "load-1", driverToken: "abc-driver-token" };
    setupDbMock([mockLoad]);

    const req = mockRequest({ "x-driver-token": "abc-driver-token" });
    const result = await validateDriverToken(req);
    expect(result).toEqual(mockLoad);
  });

  it("returns null when token does not match any load", async () => {
    const { validateDriverToken } = await getModule();
    setupDbMock([]);

    const req = mockRequest({ authorization: "Bearer invalid-token" });
    const result = await validateDriverToken(req);
    expect(result).toBeNull();
  });

  it("prefers Authorization header over x-driver-token", async () => {
    const { validateDriverToken } = await getModule();
    const mockLoad = { id: "load-1", driverToken: "bearer-token" };
    setupDbMock([mockLoad]);

    const req = mockRequest({
      authorization: "Bearer bearer-token",
      "x-driver-token": "other-token",
    });
    const result = await validateDriverToken(req);
    expect(result).toEqual(mockLoad);
  });

  it("ignores empty Bearer token", async () => {
    const { validateDriverToken } = await getModule();
    const req = mockRequest({ authorization: "Bearer " });
    const result = await validateDriverToken(req);
    expect(result).toBeNull();
  });

  it("validateDriverTokenForLoad returns null when load id doesn't match", async () => {
    const { validateDriverTokenForLoad } = await getModule();
    const mockLoad = { id: "load-1", driverToken: "test-token" };
    setupDbMock([mockLoad]);

    const req = mockRequest({ "x-driver-token": "test-token" });
    const result = await validateDriverTokenForLoad(req, "different-load-id");
    expect(result).toBeNull();
  });

  it("validateDriverTokenForLoad returns load when ids match", async () => {
    const { validateDriverTokenForLoad } = await getModule();
    const mockLoad = { id: "load-1", driverToken: "test-token" };
    setupDbMock([mockLoad]);

    const req = mockRequest({ "x-driver-token": "test-token" });
    const result = await validateDriverTokenForLoad(req, "load-1");
    expect(result).toEqual(mockLoad);
  });
});
