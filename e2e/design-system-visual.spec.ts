import { expect, test, type Page } from "@playwright/test";

// Deterministic software WebGL for the intercepted fixture map in CI.
test.use({ launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

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
  await page.route("**/api.maptiler.com/**", route => route.fulfill({
    json: { version: 8, sources: {}, layers: [{ id: "review-map", type: "background", paint: { "background-color": "#1B2231" } }] },
  }));
  await page.route("**/api/blog/latest", route => route.fulfill({ json: { posts: [] } }));
  await page.route("**/api/favorites", route => route.fulfill({ json: { data: { authenticated: false, favorites: [] } } }));
  await page.addInitScript((preferredTheme) => {
    window.localStorage.setItem("roomza-theme", preferredTheme);
  }, theme);

  await page.emulateMedia({
    colorScheme: theme,
    reducedMotion: "reduce",
  });
}

async function waitForRouteVisualReady(page: Page) {
  await expect(page.locator("main:visible").last()).toBeVisible();
}

async function expectCharcoalAmberTheme(page: Page, theme: (typeof themes)[number]) {
  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return Object.fromEntries(["primary", "selection", "panel", "background"].map(name => [name, (() => {
      const match = styles.getPropertyValue("--" + name).trim().match(/oklch\(([\d.]+)(%)?\s+([\d.]+)\s+([\d.]+)\)/);
      if (!match) throw new Error("Expected OKLCH token: " + name);
      return [Number((Number(match[1]) / (match[2] ? 100 : 1)).toFixed(6)), Number(match[3]), Number(match[4])];
    })()]));
  });
  expect(tokens).toEqual(theme === "dark"
    ? { primary: [0.985, 0.004, 84.6], selection: [0.734, 0.142, 77.3], panel: [0.285, 0.025, 265], background: [0.225, 0.024, 265] }
    : { primary: [0.218, 0.022, 265.4], selection: [0.734, 0.142, 77.3], panel: [0.985, 0.004, 84.6], background: [0.955, 0.006, 84.6] });
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
          await expectCharcoalAmberTheme(page, theme);
          if (route.path === "/") {
            await expect(page.locator("body")).toHaveAttribute("data-mobile-nav", "visible");
            await expect(page.getByRole("button", { name: "View details for Cape Town City Loft", includeHidden: true }).first()).toBeAttached({ timeout: 30_000 });
            if (viewport.name === "mobile") {
              await page.getByRole("button", { name: "Browse listings", exact: true }).click();
              await expect(page.locator("[data-snap]").first()).toHaveAttribute("data-snap", "browse");
            }
            await expect(page.getByRole("button", { name: "View details for Cape Town City Loft" }).first()).toBeAttached({
              timeout: 30_000,
            });
            await page.addStyleTag({
              content: ".maplibregl-canvas, .maplibregl-control-container { visibility: hidden !important; }",
            });
          }
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(750);

          // WebGL canvases are not stable screenshot content, so hide map
          // chrome above and mask only page imagery.
          const dynamicMedia = page.locator("img");

          await expect(page).toHaveScreenshot(
            `${route.name}-${theme}-${viewport.name}.png`,
            {
              animations: "disabled",
              caret: "hide",
              fullPage: false,
              mask: [dynamicMedia],
              maskColor: theme === "dark" ? "#242B39" : "#F2F0EC",
              maxDiffPixelRatio: 0.015,
            },
          );
        });
      }
    }
  }

  for (const theme of themes) {
    test(`discovery ${theme} amber-reference desktop`, async ({ page }) => {
      await page.setViewportSize(referenceDesktop);
      await prepareVisualState(page, theme);
      await page.route("**/api/listings**", async (request) => {
        await request.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: { listings: stableListings },
            requestId: "design-system-amber-reference",
          }),
        });
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await waitForRouteVisualReady(page);
      await expectCharcoalAmberTheme(page, theme);
      await expect(page.getByRole("button", { name: "View details for Cape Town City Loft" }).first()).toBeAttached({
        timeout: 30_000,
      });
      await page.addStyleTag({
        content: ".maplibregl-canvas, .maplibregl-control-container { visibility: hidden !important; }",
      });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(750);

      const rail = page.getByLabel("Listings near the map");
      await expect(rail).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Discovery categories" })).toBeVisible();
      const railBox = await rail.boundingBox();
      expect(railBox?.width).toBeGreaterThanOrEqual(399);
      expect(railBox?.width).toBeLessThanOrEqual(401);
      const mapBox = await page.locator("[data-discovery-map-body]").boundingBox();
      expect(mapBox!.y + mapBox!.height).toBeLessThanOrEqual(referenceDesktop.height + 1);

      const dynamicMedia = page.locator("img");
      await expect(page).toHaveScreenshot(
        `discovery-${theme}-amber-reference-desktop.png`,
        {
          animations: "disabled",
          caret: "hide",
          fullPage: false,
          mask: [dynamicMedia],
          maskColor: theme === "dark" ? "#242B39" : "#F2F0EC",
          maxDiffPixelRatio: 0.015,
        },
      );
    });
  }
});
