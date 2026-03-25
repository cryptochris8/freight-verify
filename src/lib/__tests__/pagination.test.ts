import { describe, it, expect } from "vitest";
import { buildPageUrl } from "@/lib/utils/pagination";

describe("buildPageUrl", () => {
  it("builds a basic page URL", () => {
    expect(buildPageUrl(1, {})).toBe("?page=1");
  });

  it("includes search params", () => {
    const url = buildPageUrl(2, { search: "test", status: "active" });
    expect(url).toContain("page=2");
    expect(url).toContain("search=test");
    expect(url).toContain("status=active");
  });

  it("omits undefined params", () => {
    const url = buildPageUrl(3, { search: "foo", status: undefined });
    expect(url).toContain("page=3");
    expect(url).toContain("search=foo");
    expect(url).not.toContain("status");
  });

  it("omits empty string params", () => {
    const url = buildPageUrl(1, { search: "" });
    expect(url).not.toContain("search");
  });

  it("handles special characters in values", () => {
    const url = buildPageUrl(1, { search: "hello world" });
    expect(url).toContain("search=hello+world");
  });
});
