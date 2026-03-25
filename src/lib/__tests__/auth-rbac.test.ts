import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock("react", () => ({
  cache: (fn: unknown) => fn,
}));

vi.mock("@/lib/db", () => {
  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "org-uuid-1" }]),
          }),
        }),
      }),
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
import { requireAdmin, ForbiddenError } from "@/lib/auth";

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns org context when user is admin", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      userId: "user_123",
      orgId: "org_clerk_123",
      orgRole: "org:admin",
    } as never);

    const result = await requireAdmin();

    expect(result.userId).toBe("user_123");
    expect(result.clerkOrgId).toBe("org_clerk_123");
    expect(result.orgId).toBe("org-uuid-1");
  });

  it("throws ForbiddenError when user is member", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      userId: "user_123",
      orgId: "org_clerk_123",
      orgRole: "org:member",
    } as never);

    await expect(requireAdmin()).rejects.toThrow(ForbiddenError);
  });

  it("throws Error when user is not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      userId: null,
      orgId: null,
      orgRole: null,
    } as never);

    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
  });

  it("throws Error when no org selected", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      userId: "user_123",
      orgId: null,
      orgRole: null,
    } as never);

    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
  });
});
