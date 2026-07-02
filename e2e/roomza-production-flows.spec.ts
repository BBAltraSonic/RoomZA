import { expect, test } from "@playwright/test";

test("public discovery loads with security headers", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  expect(response?.headers()["content-security-policy"]).toContain("default-src 'self'");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("region", { name: "Map" })).toBeVisible();
});

test("public listings API uses production response envelope", async ({ request }) => {
  const response = await request.get("/api/listings?bbox=18.0,-34.5,19.0,-33.5");
  expect(response.status()).toBeLessThan(500);

  if (response.ok()) {
    const body = await response.json();
    expect(body).toMatchObject({ ok: true });
    expect(body.data).toHaveProperty("listings");
    expect(body).toHaveProperty("requestId");
  }
});

test("signed document URL requires authentication", async ({ request }) => {
  const response = await request.get("/api/documents/00000000-0000-0000-0000-000000000000/signed-url");
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body).toMatchObject({ ok: false, error: { code: "unauthorized" } });
});

test("CUJ-1 renter application journey preserves the protected return path", async ({ page }) => {
  await page.goto("/applications");

  await expect(page).toHaveURL(/\/auth\?redirect=%2Fapplications/);
  await expect(page.getByRole("heading", { name: "Continue to RoomZA" })).toBeVisible();
  await expect(page.locator('input[name="redirect"]')).toHaveValue("/applications");
  await expect(page.locator("form").getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("CUJ-2 landlord listing journey preserves the dashboard return path", async ({ page }) => {
  await page.goto("/dashboard/listings/new");

  await expect(page).toHaveURL(/\/auth\?redirect=%2Fdashboard/);
  await expect(page.getByRole("heading", { name: "Continue to RoomZA" })).toBeVisible();
  await expect(page.locator('input[name="redirect"]')).toHaveValue("/dashboard");
});

test("CUJ-3 auth resilience rejects unsafe redirects and surfaces callback errors", async ({ page }) => {
  await page.goto("/auth?error=callback&redirect=https%3A%2F%2Fevil.example%2Fdashboard");

  await expect(page.getByText("Authentication failed. Please sign in again.")).toBeVisible();
  await expect(page.locator('input[name="redirect"]')).toHaveValue("/");
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/auth/forgot-password");
});

test("CUJ-4 mobile discovery renders the map-first shell without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("region", { name: "Map" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search by listing name or location" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const filterBox = await page.getByRole("button", { name: "Filter listings" }).boundingBox();
  expect(filterBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(filterBox?.height ?? 0).toBeGreaterThanOrEqual(44);
});
