import { expect, test } from "@playwright/test";

const ROUTES = [
  "/",
  "/listings",
  "/saved",
  "/applications",
  "/dashboard",
  "/messages",
  "/auth",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/onboarding",
] as const;

function isInternalNavigableHref(href: string, origin: string): boolean {
  if (href.startsWith("#")) return false;
  if (/^(mailto|tel):/i.test(href)) return false;

  const url = new URL(href, origin);
  if (url.origin !== origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return true;
}

test("reachable routes do not resolve to missing or server-error responses", async ({ request }) => {
  for (const route of ROUTES) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status(), `${route} returned ${response.status()}`).not.toBe(404);
    expect(response.status(), `${route} returned ${response.status()}`).toBeLessThan(500);
  }
});

test("rendered internal navigation links resolve to existing routes", async ({ page, request, baseURL }) => {
  const origin = new URL(baseURL ?? "http://localhost:3000").origin;
  const hrefs = new Set<string>();

  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    const routeHrefs = await page.locator("a[href]").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")).filter((href): href is string => href !== null),
    );
    for (const href of routeHrefs) {
      if (isInternalNavigableHref(href, origin)) {
        hrefs.add(new URL(href, origin).pathname);
      }
    }
  }

  for (const href of [...hrefs].sort()) {
    const response = await request.get(href, { maxRedirects: 0 });
    expect(response.status(), `${href} returned ${response.status()}`).not.toBe(404);
    expect(response.status(), `${href} returned ${response.status()}`).toBeLessThan(500);
  }
});
