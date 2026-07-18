import { expect, test, type Route } from "@playwright/test";

function listing(id: string, title: string, area: string) {
  return {
    id,
    title,
    area,
    price: 9500,
    latitude: -33.92,
    longitude: 18.42,
    bedrooms: 1,
    bathrooms: 1,
    parkingCount: 0,
    propertyType: "apartment",
    imageUrls: [],
    availabilityDate: null,
    created_at: "2026-07-01T08:00:00.000Z",
  };
}

async function fulfillListings(route: Route, listings: unknown[]) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      data: { listings },
      requestId: "search-regression",
    }),
  });
}

test("landlord trust signals stay ordered, tappable, and contained", async ({ page }) => {
  await page.goto("/issue4-test");
  await expect(page.getByText("Browser test studio")).toBeVisible();

  const trustRow = page.locator('[data-slot="landlord-trust-signals"]:visible').first();
  await expect(trustRow).toBeVisible();
  await expect(trustRow.getByRole("button")).toHaveCount(3);
  await expect(trustRow.getByRole("button").nth(0)).toContainText("Responds in 18 mins");
  await expect(trustRow.getByRole("button").nth(1)).toContainText("Verified Phone");
  await expect(trustRow.getByRole("button").nth(2)).toContainText("Verified Email");

  await trustRow.getByRole("button", { name: /Verified Phone/i }).click();
  await expect(page.getByText(/one-time code/i)).toBeVisible();
  await expect.poll(() => trustRow.evaluate((row) => row.scrollWidth <= row.clientWidth)).toBe(true);
});

test("desktop search commits explicitly, preserves URL state, and handles loading, empty, and errors", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop-only search regression.");

  const committedQueries: string[] = [];
  let releaseBraamSearch: (() => void) | undefined;
  const braamSearchGate = new Promise<void>((resolve) => {
    releaseBraamSearch = resolve;
  });

  await page.route("**/api/listings?**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    committedQueries.push(query);

    if (query === "Braam Studio") {
      await braamSearchGate;
      await fulfillListings(route, []);
      return;
    }
    if (query === "Server Error") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "server_error", message: "Unable to load listings." },
          requestId: "search-error",
        }),
      });
      return;
    }

    await fulfillListings(route, [listing("baseline", "Baseline Loft", "Sea Point")]);
  });

  await page.goto("/?q=Old&placeId=stale-place&beds=2&foo=keep");
  await expect(page.getByText("Baseline Loft").first()).toBeVisible();

  const input = page.getByRole("combobox", { name: "Search listings" });
  await input.fill("  Braam   Studio  ");
  await page.waitForTimeout(500);

  expect(committedQueries).not.toContain("Braam Studio");
  await expect(page).toHaveURL(/q=Old/);

  const desktopForm = page.locator("header").getByRole("search");
  await desktopForm.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page).toHaveURL(/q=Braam\+Studio/);
  await expect(page).not.toHaveURL(/placeId=/);
  await expect(page).toHaveURL(/beds=2/);
  await expect(page).toHaveURL(/foo=keep/);
  await expect(page.getByRole("status", { name: "Updating homes in this area" })).toBeVisible();

  releaseBraamSearch?.();
  await expect(page.getByText("Where to next?").first()).toBeVisible();

  await input.fill("Server Error");
  await desktopForm.getByRole("button", { name: "Search", exact: true }).click();

  const errorAlert = page.getByRole("alert").filter({ has: page.getByRole("button", { name: /retry/i }) });
  await expect(errorAlert.first()).toBeVisible();
});

test("mobile search has a touch-sized submit control and commits an in-view suggestion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile-only search regression.");

  const committedQueries: string[] = [];
  await page.route("**/api/listings?**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    committedQueries.push(query);
    await fulfillListings(route, query ? [] : [listing("sea-point", "Sea Point Studio", "Sea Point")]);
  });

  await page.goto("/?mode=buy&foo=keep");
  await expect.poll(() => committedQueries.includes("")).toBe(true);

  const input = page.getByRole("combobox", { name: "Search by listing name or location" });
  const mobileForm = input.locator("xpath=ancestor::form");
  const searchButton = mobileForm.getByRole("button", { name: "Search" });
  const searchButtonBox = await searchButton.boundingBox();
  expect(searchButtonBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(searchButtonBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await input.fill("Sea");
  await page.waitForTimeout(500);
  expect(committedQueries).not.toContain("Sea");

  await page.getByRole("option", { name: "Sea Point", exact: true }).click();

  await expect(page).toHaveURL(/q=Sea\+Point/);
  await expect(page).toHaveURL(/mode=buy/);
  await expect(page).toHaveURL(/foo=keep/);
  await expect.poll(() => committedQueries).toContain("Sea Point");
});

test("desktop prefilled search clears only location state and closes suggestions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop-only prefilled search regression.");

  const committedQueries: string[] = [];
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "roomza:discovery-recent-searches",
      JSON.stringify(["Cape Town", "Sea Point"]),
    );
  });
  await page.route("**/api/listings?**", async (route) => {
    committedQueries.push(new URL(route.request().url()).searchParams.get("q") ?? "");
    await fulfillListings(route, [listing("cape-town", "Cape Town Loft", "Cape Town")]);
  });

  await page.goto(
    "/?q=Cape+Town&placeId=cape-town-place&mode=buy&quick=furnished&beds=2&foo=keep",
  );

  const input = page.getByRole("combobox", { name: "Search listings" });
  await expect(input).toHaveValue("Cape Town");

  await input.focus();
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await input.press("Escape");
  await expect(input).toHaveAttribute("aria-expanded", "false");

  await page.locator("main").click({ position: { x: 8, y: 320 } });
  await input.focus();
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await page.locator("main").click({ position: { x: 8, y: 320 } });
  await expect(input).toHaveAttribute("aria-expanded", "false");

  const requestsBeforeClear = committedQueries.length;
  await page.getByRole("button", { name: "Clear search" }).click();

  await expect(input).toHaveValue("");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(page).not.toHaveURL(/(?:\?|&)q=/);
  await expect(page).not.toHaveURL(/placeId=/);
  await expect(page).toHaveURL(/mode=buy/);
  await expect(page).toHaveURL(/quick=furnished/);
  await expect(page).toHaveURL(/beds=2/);
  await expect(page).toHaveURL(/foo=keep/);
  await expect.poll(() => committedQueries.length).toBeGreaterThan(requestsBeforeClear);

  const requestsAfterClear = committedQueries.length;
  await page.waitForTimeout(750);
  expect(committedQueries).toHaveLength(requestsAfterClear);
});

test("desktop URL history replaces an uncommitted draft with the navigated prefill", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop-only history regression.");

  await page.route("**/api/listings?**", async (route) => {
    await fulfillListings(route, [listing("history", "History Loft", "Braamfontein")]);
  });

  await page.goto("/?q=First&placeId=first-place&foo=keep");
  const input = page.getByRole("combobox", { name: "Search listings" });
  await expect(input).toHaveValue("First");
  await input.fill("Uncommitted draft");

  await page.evaluate(() => {
    window.history.pushState({}, "", "/?q=Second&placeId=second-place&foo=keep");
  });
  await expect(input).toHaveValue("Second");

  await page.goBack();
  await expect(input).toHaveValue("First");

  await page.goForward();
  await expect(input).toHaveValue("Second");
});

test("mobile prefilled search clears q and placeId while preserving the discovery state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile-only prefilled search regression.");

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "roomza:discovery-recent-searches",
      JSON.stringify(["Sea Point"]),
    );
  });
  await page.route("**/api/listings?**", async (route) => {
    await fulfillListings(route, [listing("sea-point", "Sea Point Studio", "Sea Point")]);
  });

  await page.goto(
    "/?q=Sea+Point&placeId=sea-point-place&mode=buy&quick=furnished&baths=1&foo=keep",
  );

  const input = page.getByRole("combobox", { name: "Search by listing name or location" });
  await expect(input).toHaveValue("Sea Point");
  await input.focus();
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await page.locator("main").click({ position: { x: 4, y: 360 } });
  await expect(input).toHaveAttribute("aria-expanded", "false");

  await page.getByRole("button", { name: "Clear search" }).click();

  await expect(input).toHaveValue("");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(page).not.toHaveURL(/(?:\?|&)q=/);
  await expect(page).not.toHaveURL(/placeId=/);
  await expect(page).toHaveURL(/mode=buy/);
  await expect(page).toHaveURL(/quick=furnished/);
  await expect(page).toHaveURL(/baths=1/);
  await expect(page).toHaveURL(/foo=keep/);
});
