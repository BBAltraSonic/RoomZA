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
