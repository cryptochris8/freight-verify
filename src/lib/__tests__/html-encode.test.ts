import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/utils/html-encode";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
    );
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("handles null", () => {
    expect(escapeHtml(null)).toBe("");
  });

  it("handles undefined", () => {
    expect(escapeHtml(undefined)).toBe("");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("passes through safe strings unchanged", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });

  it("handles multiple special characters together", () => {
    expect(escapeHtml(`<a href="test">&'x'</a>`)).toBe(
      "&lt;a href=&quot;test&quot;&gt;&amp;&#39;x&#39;&lt;/a&gt;"
    );
  });
});
