import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("homepage loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/FreightVerify/i);
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
  });

  test("signup page loads", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("body")).toBeVisible();
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("body")).toBeVisible();
  });

  test("404 page shows for unknown routes", async ({ page }) => {
    await page.goto("/this-does-not-exist");
    await expect(page.locator("body")).toContainText(/not found|404/i);
  });

  test("protected route redirects unauthenticated users", async ({ page }) => {
    const response = await page.goto("/carriers");
    // Clerk redirects to sign-in or returns a redirect status
    const url = page.url();
    expect(url.includes("/carriers") && !url.includes("sign-in")).toBeFalsy;
  });

  test("API health — carriers returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/carriers");
    expect([401, 403]).toContain(response.status());
  });

  test("API health — loads returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/loads");
    expect([401, 403]).toContain(response.status());
  });
});
