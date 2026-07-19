/**
 * Lighthouse CI configuration — Discovery_Page_Experience lab CWV harness.
 *
 * Verifies the site root ("/") against the Core Web Vitals / Lighthouse budgets
 * from requirements 11.1–11.4 on a mid-tier mobile profile (Moto G4-class device,
 * 4x CPU slowdown, throttled 4G — Lighthouse's default `mobile` emulation):
 *
 *   - Performance score  >= 90   (Req 11.4)
 *   - Largest Contentful Paint <= 2.5s   (Req 11.1)
 *   - Cumulative Layout Shift  <= 0.1    (Req 11.2)
 *   - Interaction to Next Paint <= 200ms (Req 11.3)
 *
 * Run locally or in CI with:  npm run lighthouse
 * (requires the dev dependency `@lhci/cli` and a Chrome/Chromium binary).
 *
 * INP note: Interaction to Next Paint is fundamentally a *field* metric driven by
 * real user interactions. Lighthouse's cold-navigation lab run reports
 * `interaction-to-next-paint` as "not applicable" (LHCI passes not-applicable
 * audits), so Total Blocking Time is enforced as the reliable lab proxy for INP
 * while the INP assertion is retained for user-flow / field collection.
 */

/** @type {import('@lhci/cli').LighthouseCiConfig} */
module.exports = {
  ci: {
    collect: {
      // Build must exist first (`npm run build`). Boot the production server,
      // then audit the site root once the server is ready.
      startServerCommand: "npm run start",
      startServerReadyPattern: "Ready in|Local:|started server",
      startServerReadyTimeout: 60000,
      url: ["http://localhost:3000/"],
      numberOfRuns: 3,
      settings: {
        // Mid-tier mobile profile: Lighthouse's default mobile emulation
        // (Moto G4-class screen) with simulated 4x CPU slowdown over slow 4G.
        formFactor: "mobile",
        throttlingMethod: "simulate",
        screenEmulation: {
          mobile: true,
          width: 360,
          height: 640,
          deviceScaleFactor: 2,
          disabled: false,
        },
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          requestLatencyMs: 562.5,
          downloadThroughputKbps: 1474.56,
          uploadThroughputKbps: 675,
          cpuSlowdownMultiplier: 4,
        },
        emulatedUserAgent:
          "Mozilla/5.0 (Linux; Android 11; moto g(4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        // Headless Chrome flags so the harness runs in CI containers.
        chromeFlags: "--headless=new --no-sandbox --disable-gpu",
      },
    },
    assert: {
      assertions: {
        // Req 11.4 — Lighthouse Performance score >= 90.
        "categories:performance": ["error", { minScore: 0.9 }],
        // Req 11.1 — LCP <= 2.5s.
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        // Req 11.2 — CLS <= 0.1.
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        // Req 11.3 — INP <= 200ms. Retained for user-flow/field collection;
        // not-applicable in cold-navigation lab runs (LHCI passes those).
        "interaction-to-next-paint": ["error", { maxNumericValue: 200 }],
        // Lab proxy for INP: Total Blocking Time <= 200ms (Req 11.3).
        "total-blocking-time": ["error", { maxNumericValue: 200 }],
      },
    },
    upload: {
      // Store reports on LHCI's temporary public storage. Swap for an LHCI
      // server / filesystem target if long-term trend tracking is desired.
      target: "temporary-public-storage",
    },
  },
};
