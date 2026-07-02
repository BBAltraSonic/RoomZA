import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // E2E runs against a production build, not the dev server. Next.js dev
        // mode compiles routes on-demand (tens of seconds per first hit), which
        // is unrepresentative of production and blows past Playwright timeouts.
        // A production build serves the discovery page in ~2s cold / <100ms warm.
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        // Allow time for `next build` to finish before the server is reachable.
        timeout: 240_000,
        reuseExistingServer: !process.env.CI,
      },
});
