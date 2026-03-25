/**
 * Builds a pagination URL preserving existing search params.
 *
 * Usage:
 *   buildPageUrl(3, { search: "foo", status: "active" })
 *   // → "?page=3&search=foo&status=active"
 */
export function buildPageUrl(
  page: number,
  params: Record<string, string | undefined>
): string {
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  return "?" + sp.toString();
}
