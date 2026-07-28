import { expect, test, type Page } from "@playwright/test";

const routes = [
  { name: "discovery", path: "/" },
  { name: "auth", path: "/auth" },
  { name: "blog", path: "/blog" },
  { name: "listings", path: "/listings" },
] as const;

const themes = ["light", "dark"] as const;
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const referenceDesktop = { width: 1310, height: 684 } as const;

const stableListings = [
  {
    id: "visual-cape-town-loft",
    title: "Cape Town City Loft",
    area: "29 Irozi Street, Cape Town",
    price: 12_500,
    latitude: -33.9249,
    longitude: 18.4241,
    bedrooms: 1,
    bathrooms: 1,
    parkingCount: 1,
    propertyType: "apartment",
    imageUrls: [],
    availabilityDate: "2026-08-01",
    created_at: "2026-07-28T06:00:00.000Z",
  },
  {
    id: "visual-sea-point-flat",
    title: "Sea Point Flat",
    area: "Main Road, Sea Point, Cape Town",
    price: 17_900,
    latitude: -33.9182,
    longitude: 18.3854,
    bedrooms: 2,
    bathrooms: 1,
    parkingCount: 0,
    propertyType: "apartment",
    imageUrls: [],
    availabilityDate: "2026-08-15",
    created_at: "2026-07-27T06:00:00.000Z",
  },
] as const;

async function prepareVisualState(page: Page, theme: (typeof themes)[number]) {
  await page.addInitScript((preferredTheme) => {
    window.localStorage.setItem("roomza-theme", preferredTheme);
  }, theme);

  await page.emulateMedia({
    colorScheme: theme,
    reducedMotion: "reduce",
  });
}

async function waitForRouteVisualReady(page: Page) {
  await page.addStyleTag({
    content:
      "[data-motion-route] { opacity: 1 !important; transform: none !important; filter: none !important; }",
  });
  await expect(page.locator("main:visible").last()).toBeVisible();
}

async function expectGreenTheme(page: Page, theme: (typeof themes)[number]) {
  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      forest: styles.getPropertyValue("--forest").trim(),
      surface: styles.getPropertyValue("--warm-surface").trim(),
      panel: styles.getPropertyValue("--panel").trim(),
    };
  });

  expect(tokens).toEqual(
    theme === "dark"
      ? {
          forest: "oklch(0.74 0.1 158)",
          surface: "oklch(0.23 0.006 165)",
          panel: "oklch(0.275 0.006 165)",
        }
      : {
          forest: "oklch(0.34 0.062 164)",
          surface: "oklch(0.968 0.003 165)",
          panel: "oklch(0.992 0.002 165)",
        },
  );
}

test.describe("inspiration-matched design system", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "The spec owns the exact desktop and mobile viewport contract.",
  );

  for (const viewport of viewports) {
    for (const theme of themes) {
      for (const route of routes) {
        test(`${route.name} ${theme} ${viewport.name}`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await prepareVisualState(page, theme);
          await page.route("**/api/listings**", async (request) => {
            await request.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                ok: true,
                data: { listings: stableListings },
                requestId: "design-system-visual",
              }),
            });
          });
          await page.goto(route.path, { waitUntil: "domcontentloaded" });
          await waitForRouteVisualReady(page);
          await expectGreenTheme(page, theme);
          if (route.path === "/") {
            await expect(page.getByText("Cape Town City Loft").first()).toBeAttached({
              timeout: 30_000,
            });
            await page.addStyleTag({
              content: ".gm-style, .gm-style iframe { visibility: hidden !important; }",
            });
          }
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(750);

          // Google Maps owns large helper iframes whose boxes can extend under
          // the results rail. Masking every iframe paints over the hero and
          // cards, so hide the map chrome above and mask only page imagery.
          const dynamicMedia = page.locator("img:not(.gm-style img)");

          await expect(page).toHaveScreenshot(
            `${route.name}-${theme}-${viewport.name}.png`,
            {
              animations: "disabled",
              caret: "hide",
              fullPage: false,
              mask: [dynamicMedia],
              maskColor: theme === "dark" ? "#213027" : "#DDE8E1",
              maxDiffPixelRatio: 0.015,
            },
          );
        });
      }
    }
  }

  for (const theme of themes) {
    test(`discovery ${theme} green-reference desktop`, async ({ page }) => {
      await page.setViewportSize(referenceDesktop);
      await prepareVisualState(page, theme);
      await page.route("**/api/listings**", async (request) => {
        await request.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: { listings: stableListings },
            requestId: "design-system-green-reference",
          }),
        });
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await waitForRouteVisualReady(page);
      await expectGreenTheme(page, theme);
      await expect(page.getByText("Cape Town City Loft").first()).toBeAttached({
        timeout: 30_000,
      });
      await page.addStyleTag({
        content: ".gm-style, .gm-style iframe { visibility: hidden !important; }",
      });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(750);

      const rail = page.getByLabel("Listings near the map");
      const filterRow = page.locator('[data-slot="desktop-filter-row"]');
      const searchSurface = page.locator('[data-slot="desktop-search-surface"]');
      const spotlight = page.locator('[data-slot="desktop-area-spotlight"]');

      await expect(rail).toBeVisible();
      await expect(filterRow).toBeVisible();
      await expect(searchSurface).toBeVisible();
      await expect(spotlight).toBeVisible();

      const railBox = await rail.boundingBox();
      const filterBox = await filterRow.boundingBox();
      const searchBox = await searchSurface.boundingBox();
      expect(railBox?.width).toBeGreaterThanOrEqual(464);
      expect(railBox?.width).toBeLessThanOrEqual(466);
      expect(filterBox?.height).toBeGreaterThanOrEqual(60);
      expect(filterBox?.height).toBeLessThanOrEqual(62);
      expect(searchBox?.width).toBeLessThanOrEqual(522);

      const dynamicMedia = page.locator("img:not(.gm-style img)");
      await expect(page).toHaveScreenshot(
        `discovery-${theme}-green-reference-desktop.png`,
        {
          animations: "disabled",
          caret: "hide",
          fullPage: false,
          mask: [dynamicMedia],
          maskColor: theme === "dark" ? "#213027" : "#DDE8E1",
          maxDiffPixelRatio: 0.015,
        },
      );
    });
  }
});
