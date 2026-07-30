import { expect, test, type Page } from "@playwright/test";

const mobileViewport = { width: 390, height: 844 } as const;
const themes = ["light", "dark"] as const;

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

async function installDiscoveryRoutes(page: Page, theme: (typeof themes)[number]) {
  await page.route("https://api.maptiler.com/maps/base-v4-*/style.json**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 8,
        name: "Mobile promo visual fixture",
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: {
              "background-color": theme === "dark" ? "#27312c" : "#eaf1ed",
            },
          },
        ],
      }),
    });
  });
  await page.route("**/api/listings**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/listings") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { listings: stableListings },
          requestId: "mobile-promo-visual",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Visual detail fixture omitted" }),
    });
  });
}

async function prepareDiscovery(page: Page, theme: (typeof themes)[number]) {
  await page.setViewportSize(mobileViewport);
  await page.addInitScript((preferredTheme) => {
    window.localStorage.setItem("roomza-theme", preferredTheme);
    window.sessionStorage.removeItem("roomza:mobile-sheet-snap");
  }, theme);
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await installDiscoveryRoutes(page, theme);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.addStyleTag({
    content:
      "[data-motion-route] { opacity: 1 !important; transform: none !important; filter: none !important; } .maplibregl-canvas, .maplibregl-control-container { visibility: hidden !important; }",
  });
  await expect(page.getByText("Cape Town City Loft").first()).toBeAttached({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Browse listings", exact: true }).click();
}

test.describe("mobile discovery promo and pills", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "The spec owns its exact 390 by 844 viewport contract.",
  );

  for (const theme of themes) {
    test(`${theme} Browse keeps promo, pills, listings and map context visible`, async ({ page }) => {
      await prepareDiscovery(page, theme);

      const sheet = page.locator('[data-snap="browse"]');
      const promo = sheet.locator('[data-slot="mobile-area-spotlight"]');
      const quickFilters = sheet.getByRole("list", { name: "Quick filters", exact: true });
      const listingTrack = sheet.locator('[data-slot="listing-carousel-track"]');

      await expect(promo).toBeVisible();
      await expect(quickFilters).toBeVisible();
      await expect(listingTrack).toBeVisible();
      await expect(sheet.getByRole("button", { name: "Scroll quick filters left" })).toHaveCount(0);
      await expect(sheet.getByRole("button", { name: "Scroll quick filters right" })).toHaveCount(0);

      const metrics = await page.evaluate(() => {
        const sheetElement = document.querySelector<HTMLElement>('[data-snap="browse"]');
        const promoElement = sheetElement?.querySelector<HTMLElement>('[data-slot="mobile-area-spotlight"]');
        const quickFilterTrack = sheetElement?.querySelector<HTMLElement>('[data-slot="quick-filter-track"]');
        const listingCarouselTrack = sheetElement?.querySelector<HTMLElement>('[data-slot="listing-carousel-track"]');
        const touchTargets = [
          ...(quickFilterTrack?.querySelectorAll<HTMLElement>("button") ?? []),
          ...(promoElement?.querySelectorAll<HTMLElement>("button") ?? []),
        ];
        const sheetRect = sheetElement?.getBoundingClientRect();
        const promoRect = promoElement?.getBoundingClientRect();
        const quickFilterRect = quickFilterTrack?.getBoundingClientRect();
        const listingRect = listingCarouselTrack?.getBoundingClientRect();
        return {
          visibleSheetRatio: sheetRect ? (window.innerHeight - sheetRect.top) / window.innerHeight : 0,
          visibleMapRatio: sheetRect ? sheetRect.top / window.innerHeight : 0,
          promoHeight: promoRect?.height ?? 0,
          promoBottom: promoRect?.bottom ?? 0,
          quickFilterTop: quickFilterRect?.top ?? 0,
          quickFilterBottom: quickFilterRect?.bottom ?? 0,
          listingTop: listingRect?.top ?? Number.POSITIVE_INFINITY,
          minTouchTarget: Math.min(
            ...touchTargets.map((target) => {
              const rect = target.getBoundingClientRect();
              return Math.min(rect.width, rect.height);
            }),
          ),
        };
      });

      expect(metrics.visibleSheetRatio).toBeGreaterThanOrEqual(0.53);
      expect(metrics.visibleSheetRatio).toBeLessThanOrEqual(0.55);
      expect(metrics.visibleMapRatio).toBeGreaterThanOrEqual(0.45);
      expect(metrics.promoHeight).toBe(132);
      expect(metrics.promoBottom).toBeLessThanOrEqual(metrics.quickFilterTop);
      expect(metrics.quickFilterBottom).toBeLessThanOrEqual(metrics.listingTop);
      expect(metrics.listingTop).toBeLessThan(mobileViewport.height);
      expect(metrics.minTouchTarget).toBeGreaterThanOrEqual(44);

      const dynamicMedia = page.locator("img");
      await expect(page).toHaveScreenshot(`mobile-discovery-promo-${theme}.png`, {
        animations: "disabled",
        caret: "hide",
        fullPage: false,
        mask: [dynamicMedia],
        maskColor: theme === "dark" ? "#34413A" : "#E6EFEA",
        maxDiffPixelRatio: 0.015,
      });

      await page.getByRole("button", { name: "View first home", exact: true }).click();
      await expect(page).toHaveURL(/[?&]listingId=visual-cape-town-loft(?:&|$)/);
    });
  }

  test("desktop green-reference geometry remains unchanged", async ({ page }) => {
    await page.setViewportSize({ width: 1310, height: 684 });
    await page.addInitScript(() => {
      window.localStorage.setItem("roomza-theme", "light");
    });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await installDiscoveryRoutes(page, "light");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Cape Town City Loft").first()).toBeAttached({
      timeout: 30_000,
    });

    const rail = page.getByLabel("Listings near the map");
    const filterRow = page.locator('[data-slot="desktop-filter-row"]');
    const searchSurface = page.locator('[data-slot="desktop-search-surface"]');
    const desktopPromo = page.locator('[data-slot="desktop-area-spotlight"]');
    const mobilePromo = page.locator('[data-slot="mobile-area-spotlight"]');

    await expect(rail).toBeVisible();
    await expect(filterRow).toBeVisible();
    await expect(searchSurface).toBeVisible();
    await expect(desktopPromo).toBeVisible();
    await expect(mobilePromo).toBeHidden();

    const railBox = await rail.boundingBox();
    const filterBox = await filterRow.boundingBox();
    const searchBox = await searchSurface.boundingBox();
    expect(railBox?.width).toBeGreaterThanOrEqual(464);
    expect(railBox?.width).toBeLessThanOrEqual(466);
    expect(filterBox?.height).toBeGreaterThanOrEqual(60);
    expect(filterBox?.height).toBeLessThanOrEqual(62);
    expect(searchBox?.width).toBeLessThanOrEqual(522);
  });
});
