import { expect, test } from "@playwright/test";

test.describe("Pinpoint motion system", () => {
  test("records forward and back route direction and restores heading focus", async ({ page }) => {
    await page.goto("/auth");
    const forgotPasswordLink = page.getByRole("link", { name: "Forgot your password?" });
    await Promise.all([
      page.waitForURL(/\/auth\/forgot-password/),
      forgotPasswordLink.evaluate((link: HTMLAnchorElement) => link.click()),
    ]);

    const forwardRoute = page.locator("[data-motion-route]").last();
    await expect(forwardRoute).toHaveAttribute("data-motion-route", "forward");
    await expect(forwardRoute.locator("main h1")).toBeFocused();
    await expect(page.locator("[data-motion-route]")).toHaveCount(1);
    await expect(forwardRoute).toHaveCSS("filter", "none");

    await page.goBack();
    await expect(page).toHaveURL(/\/auth$/);
    const backRoute = page.locator("[data-motion-route]").last();
    await expect(backRoute).toHaveAttribute("data-motion-route", "back");
    await expect(backRoute.locator("main h1")).toBeFocused();
    await expect(page.locator("[data-motion-route]")).toHaveCount(1);
    await expect(backRoute).toHaveCSS("filter", "none");

    await page.goForward();
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
    const browserForwardRoute = page.locator("[data-motion-route]").last();
    await expect(browserForwardRoute).toHaveAttribute("data-motion-route", "forward");
    await expect(browserForwardRoute.locator("main h1")).toBeFocused();
    await expect(page.locator("[data-motion-route]")).toHaveCount(1);
    await expect(browserForwardRoute).toHaveCSS("filter", "none");
  });

  test("keeps reduced-motion route feedback free of travel, zoom, and blur", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/auth");
    await page.getByRole("link", { name: "Forgot your password?" }).click();

    const route = page.locator("[data-motion-route]").last();
    await expect(route).toHaveAttribute("data-motion-route", "forward");
    await expect(route).toHaveCSS("transform", "none");
    await expect(route).toHaveCSS("filter", "none");
  });

  test("uses a shared sliding indicator for auth mode changes", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator('[data-motion-layout-id="auth-mode-indicator"]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Create account" }).first()).toHaveClass(/text-forest/);
  });

  test("keeps list-mode filters inside the mobile viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Mobile discovery assertion");

    await page.goto("/");
    await page.getByRole("button", { name: "List view" }).click();
    await page.getByRole("button", { name: "Type" }).click();

    const dropdown = page
      .getByRole("heading", { name: "Property types" })
      .filter({ visible: true })
      .locator("..");
    await expect(dropdown).toBeVisible();
    const box = await dropdown.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  });

  test("suppresses pointer glow for coarse pointers", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Coarse-pointer assertion");

    await page.goto("/auth");
    const state = await page.evaluate(() => {
      const card = document.createElement("div");
      card.className = "motion-interactive property-card-pointer-glow";
      document.body.append(card);
      const result = {
        coarse: matchMedia("(pointer: coarse)").matches,
        glowDisplay: getComputedStyle(card, "::before").display,
      };
      card.remove();
      return result;
    });

    expect(state.coarse).toBe(true);
    expect(state.glowDisplay).toBe("none");
  });
});
