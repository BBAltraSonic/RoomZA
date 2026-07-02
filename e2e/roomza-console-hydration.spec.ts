import { expect, test, type Page } from "@playwright/test";

const HYDRATION_WARNING = /hydration|hydrated|did not match|text content does not match|server rendered html/i;

async function withConsoleHydrationGuard(page: Page, journey: () => Promise<void>): Promise<void> {
  const failures: string[] = [];

  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" || HYDRATION_WARNING.test(text)) {
      failures.push(`[console:${message.type()}] ${text}`);
    }
  });
  page.on("pageerror", (error) => {
    failures.push(`[pageerror] ${error.message}`);
  });

  await journey();
  await page.waitForLoadState("networkidle").catch(() => undefined);

  expect(failures).toEqual([]);
}

test("CUJ-1 renter protected route has no console errors or hydration warnings", async ({ page }) => {
  await withConsoleHydrationGuard(page, async () => {
    await page.goto("/applications");

    await expect(page).toHaveURL(/\/auth\?redirect=%2Fapplications/);
    await expect(page.getByRole("heading", { name: "Continue to RoomZA" })).toBeVisible();
  });
});

test("CUJ-2 landlord protected route has no console errors or hydration warnings", async ({ page }) => {
  await withConsoleHydrationGuard(page, async () => {
    await page.goto("/dashboard/listings/new");

    await expect(page).toHaveURL(/\/auth\?redirect=%2Fdashboard/);
    await expect(page.getByRole("heading", { name: "Continue to RoomZA" })).toBeVisible();
  });
});

test("CUJ-3 auth resilience has no console errors or hydration warnings", async ({ page }) => {
  await withConsoleHydrationGuard(page, async () => {
    await page.goto("/auth?error=callback&redirect=https%3A%2F%2Fevil.example%2Fdashboard");

    await expect(page.getByText("Authentication failed. Please sign in again.")).toBeVisible();
    await expect(page.locator('input[name="redirect"]')).toHaveValue("/");
  });
});

test("CUJ-4 mobile discovery has no console errors or hydration warnings", async ({ page }) => {
  await withConsoleHydrationGuard(page, async () => {
    await page.route("**/api/listings?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { listings: [] }, requestId: "console-hydration-cuj" }),
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto("/");

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("region", { name: "Map" })).toBeVisible();
  });
});
