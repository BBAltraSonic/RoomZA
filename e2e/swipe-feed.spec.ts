import { expect, test, type Page } from "@playwright/test";

/**
 * Swipe feed flows (.kiro/specs/swipe-feed, task 13). The feed is behind
 * SWIPE_FEED, so these run only when the server under test was started with
 * SWIPE_FEED=on, or SWIPE_FEED=preview (then every URL carries ?feed=1).
 */
const mode = process.env.SWIPE_FEED;
test.skip(mode !== "on" && mode !== "preview", "Start the server with SWIPE_FEED=on or preview to run the feed flows.");
const preview = mode === "preview";

const homes = [
  home("feed-a", "Garden cottage", -26.19, 28.03),
  home("feed-b", "City loft", -26.21, 28.06),
  home("feed-c", "Beach flat", -26.23, 28.04),
];
const GONE_ID = "00000000-0000-4000-8000-00000000dead";

function home(id: string, title: string, latitude: number, longitude: number) {
  return {
    id, title, area: "Parkhurst", price: 9500, latitude, longitude, bedrooms: 1, bathrooms: 1,
    parkingCount: 0, propertyType: "apartment", imageUrls: [], availabilityDate: null, created_at: "2026-11-01T08:00:00.000Z",
  };
}

function detail(id: string) {
  const listing = homes.find((candidate) => candidate.id === id)!;
  return {
    id, title: listing.title, address: "4 Oak Avenue, Parkhurst", price: listing.price, listing_type: "rent",
    latitude: listing.latitude, longitude: listing.longitude, bedrooms: 1, bathrooms: 1, property_type: "apartment",
    parking_type: "none", parking_count: 0, electricity_type: "prepaid", water_availability: "municipal",
    lease_duration: "12_months", availability_date: "2026-12-01", created_at: listing.created_at,
    metadata: null, images: [], deposit_amount: 9500, admin_fee: 0,
  };
}

function withFlag(path: string) {
  if (!preview) return path;
  return `${path}${path.includes("?") ? "&" : "?"}feed=1`;
}

async function installRoutes(page: Page) {
  // A blank style: the map loads and reports its bounds without real tiles.
  await page.route("https://api.maptiler.com/**", async (route) => {
    if (route.request().url().includes("style.json")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#eaf1ed" } }] }),
      });
      return;
    }
    await route.fulfill({ status: 404, body: "" });
  });
  await page.route("**/api/favorites**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: { authenticated: false, favorites: [] } }),
  }));
  await page.route("**/api/listings**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/listings") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { listings: homes }, requestId: "swipe-feed" }) });
      return;
    }
    const id = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    if (!homes.some((candidate) => candidate.id === id)) {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "not_found", message: "Listing not found." } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: detail(id) }) });
  });
}

const feed = (page: Page) => page.locator('[data-slot="swipe-feed"]:visible');
// The card behind the current one is hidden from assistive tech, so this finds only the current card.
const currentCard = (page: Page) => feed(page).getByRole("article");
// Phone and desktop sort results differently, so flows follow whichever card is current.
const currentId = async (page: Page) => (await currentCard(page).getAttribute("data-listing-id"))!;
const titleOf = (id: string) => homes.find((candidate) => candidate.id === id)!.title;

test("phone: pass, undo, save as a guest, read details and go back to the map", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Phone flow.");
  await installRoutes(page);
  await page.goto(withFlag("/?view=feed"));

  await expect(feed(page).getByText("1 / 3")).toBeVisible({ timeout: 30_000 });
  const first = await currentId(page);
  await expect(currentCard(page)).toHaveAccessibleName(titleOf(first));

  await currentCard(page).getByRole("button", { name: "Pass" }).click();
  await expect(currentCard(page)).not.toHaveAttribute("data-listing-id", first);
  const second = await currentId(page);
  await expect(page).toHaveURL(new RegExp(`listingId=${second}`));
  expect(await page.evaluate(() => window.sessionStorage.getItem("pinpoint.feed.passed.v1"))).toContain(first);

  await currentCard(page).getByRole("button", { name: "Undo" }).click();
  await expect(currentCard(page)).toHaveAttribute("data-listing-id", first);

  // A guest's save stays on this device; it never sends them to sign in.
  await currentCard(page).getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await expect(currentCard(page)).not.toHaveAttribute("data-listing-id", first);
  expect(page.url()).not.toContain("/auth");
  expect(await page.evaluate(() => window.localStorage.getItem("pinpoint.feed.guest-saves.v1"))).toContain(first);

  await currentCard(page).getByRole("button", { name: "Details" }).click();
  await expect(currentCard(page).getByRole("group", { name: "Property actions" })).toBeVisible();

  await feed(page).getByRole("button", { name: "Map", exact: true }).click();
  await expect(feed(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/view=feed/);
});

test("desktop: a result opens the feed beside the map, keys decide, and the passed pin dims", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop flow.");
  await installRoutes(page);
  await page.goto(withFlag("/"));

  const resultCard = page.locator('[data-card-category="property"][data-card-id="feed-b"] h3 button').first();
  await expect(resultCard).toBeVisible({ timeout: 30_000 });
  await resultCard.click();

  await expect(currentCard(page)).toHaveAccessibleName("City loft");
  await expect(page).toHaveURL(/view=feed/);
  await expect(page).toHaveURL(/listingId=feed-b/);
  await expect(page.locator(".maplibregl-map")).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await expect(currentCard(page)).toHaveAccessibleName("Beach flat");
  await expect(page.getByRole("button", { name: /^City loft - .*, passed/ })).toHaveAttribute("data-passed", "true");

  await page.keyboard.press("z");
  await expect(currentCard(page)).toHaveAccessibleName("City loft");

  await page.keyboard.press("m");
  await expect(feed(page)).toHaveCount(0);
});

test("a dead listing link says so and carries on with the area", async ({ page }) => {
  await installRoutes(page);
  await page.goto(withFlag(`/listing/${GONE_ID}`));

  await expect(page.getByText("That listing is no longer available.")).toBeVisible({ timeout: 30_000 });
  await expect(feed(page).getByText("1 / 3")).toBeVisible();
  await expect(currentCard(page)).toHaveAccessibleName(titleOf(await currentId(page)));
  await expect(page).toHaveTitle(/Listing Unavailable/);
});
