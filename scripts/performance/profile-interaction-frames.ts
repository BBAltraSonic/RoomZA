/**
 * Interaction frame-rate profiling harness (Discovery_Page_Experience,
 * Req 10.1, 10.2, 10.4, 10.6).
 *
 * WHAT THIS IS
 * ------------
 * A scripted lab harness that drives the two interaction paths the design calls
 * out — map pan/zoom and Bottom_Sheet drag — while recording per-frame work in
 * the page, then reports how each interaction performed against the two
 * Frame_Budgets:
 *   - 60 FPS  → 16.7 ms per frame (Req 10.1)
 *   - 120 FPS →  8.3 ms per frame (Req 10.2)
 *
 * It also records main-thread long tasks (the primary cause of dropped frames)
 * as the "per-frame work" signal, and drags the Bottom_Sheet to exercise the
 * one-update-per-frame position path (Req 10.4).
 *
 * WHY IT MEASURES INSTEAD OF ASSERTS
 * ----------------------------------
 * Frame timing depends on the host CPU/GPU, the display refresh rate, and
 * whether the map SDK's WebGL tiles are warm — none of which are stable in CI.
 * So this harness DOCUMENTS measured values (and writes them to a JSON report)
 * rather than failing a build. It is deliberately NOT wired into `npm test` or
 * the CI test stage; run it manually on representative hardware.
 *
 * HOW TO RUN
 * ----------
 *   1. Start the app (a production build is most representative):
 *        npm run build && npm run start        # serves http://localhost:3000
 *      or for a quick pass:
 *        npm run dev
 *   2. In another shell:
 *        npm run profile:frames
 *      Optionally point it at another origin:
 *        FRAME_PROFILE_URL=https://staging.example.com npm run profile:frames
 *      Set FRAME_PROFILE_HEADED=1 to watch the run in a visible browser.
 *
 * The measured summary is printed to the console and written to
 * `scripts/performance/.frame-profile-report.json`.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, devices, type Browser, type Page } from "@playwright/test";

import {
  formatSummary,
  summarizeFrames,
  summarizeLongTasks,
  type FrameBudgetSummary,
  type LongTaskSample,
  type LongTaskSummary,
} from "./frame-budget";

const BASE_URL = process.env.FRAME_PROFILE_URL || process.env.E2E_BASE_URL || "http://localhost:3000";
const HEADED = process.env.FRAME_PROFILE_HEADED === "1";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const reportPath = path.join(scriptDir, ".frame-profile-report.json");

type ScenarioReport = {
  scenario: string;
  status: "measured" | "skipped";
  category?: "application-motion" | "map-cold-load";
  note?: string;
  frames?: FrameBudgetSummary;
  longTasks?: LongTaskSummary;
  acceptance?: {
    effectiveFpsAtLeast60: boolean;
    p95AtMost16Point7Ms: boolean;
    noLongTaskOver50Ms: boolean;
    passed: boolean;
  };
};

function measuredReport(
  scenario: string,
  timestamps: number[],
  longTaskSamples: LongTaskSample[],
  category: ScenarioReport["category"] = "application-motion",
): ScenarioReport {
  const frames = summarizeFrames(timestamps);
  const longTasks = summarizeLongTasks(longTaskSamples);
  const acceptance = {
    effectiveFpsAtLeast60: frames.effectiveFps >= 60,
    p95AtMost16Point7Ms: frames.p95Ms <= 16.7,
    noLongTaskOver50Ms: longTasks.longestMs <= 50,
    passed: false,
  };
  acceptance.passed = acceptance.effectiveFpsAtLeast60
    && acceptance.p95AtMost16Point7Ms
    && acceptance.noLongTaskOver50Ms;
  return { scenario, status: "measured", category, frames, longTasks, acceptance };
}

/** Raw browser script avoids transform-runtime helpers leaking into Playwright serialization. */
const FRAME_RECORDER_SOURCE = `(() => {
  const w = window;
  if (w.__frameProfile && typeof w.__frameProfileStart === "function" && typeof w.__frameProfileStop === "function") return;
  const state = { recording: false, timestamps: [], longTasks: [], observer: undefined };
  w.__frameProfile = state;
  function tick(now) {
    if (!state.recording) return;
    state.timestamps.push(now);
    requestAnimationFrame(tick);
  }
  try {
    const observer = new PerformanceObserver((list) => {
      if (!state.recording) return;
      for (const entry of list.getEntries()) state.longTasks.push({ startMs: entry.startTime, durationMs: entry.duration });
    });
    observer.observe({ entryTypes: ["longtask"] });
    state.observer = observer;
  } catch {}
  w.__frameProfileStart = () => {
    state.recording = true;
    state.timestamps = [];
    state.longTasks = [];
    requestAnimationFrame(tick);
  };
  w.__frameProfileStop = () => {
    state.recording = false;
    return { timestamps: state.timestamps.slice(), longTasks: state.longTasks.slice() };
  };
})()`;

async function startRecording(page: Page): Promise<void> {
  // Reinstall in the active document. Client navigations and browser restore
  // paths can preserve a partial window marker while replacing callbacks.
  await page.evaluate(FRAME_RECORDER_SOURCE);
  await page.evaluate(() => {
    (window as unknown as { __frameProfileStart: () => void }).__frameProfileStart();
  });
}

async function stopRecording(page: Page): Promise<{ timestamps: number[]; longTasks: LongTaskSample[] }> {
  return page.evaluate(() => {
    return (
      window as unknown as {
        __frameProfileStop: () => { timestamps: number[]; longTasks: LongTaskSample[] };
      }
    ).__frameProfileStop();
  });
}

/** Pan the map by dragging across the map region, then zoom with the wheel. */
async function profileMapPanZoom(page: Page): Promise<ScenarioReport> {
  const mapRegion = page.getByRole("region", { name: "Map" });
  try {
    await mapRegion.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    return { scenario: "Map pan/zoom", status: "skipped", note: "Map region not found within 15s." };
  }

  const box = await mapRegion.boundingBox();
  if (!box) {
    return { scenario: "Map pan/zoom", status: "skipped", note: "Map region has no layout box." };
  }

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  await startRecording(page);

  // Pan: press and drag in small steps so each move produces a frame.
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  for (let step = 1; step <= 24; step += 1) {
    await page.mouse.move(centerX - step * 6, centerY - step * 3, { steps: 2 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();

  // Zoom: repeated wheel deltas over the map center.
  await page.mouse.move(centerX, centerY);
  for (let i = 0; i < 12; i += 1) {
    await page.mouse.wheel(0, i % 2 === 0 ? -120 : 120);
    await page.waitForTimeout(40);
  }

  await page.waitForTimeout(200);
  const { timestamps, longTasks } = await stopRecording(page);

  return measuredReport("Map pan/zoom (cold map workload)", timestamps, longTasks, "map-cold-load");
}

/** Drag the Bottom_Sheet grab handle up and down to exercise the drag path. */
async function profileSheetDrag(page: Page): Promise<ScenarioReport> {
  const handle = page.getByRole("button", { name: "Resize listings sheet" });
  try {
    await handle.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    return {
      scenario: "Bottom_Sheet drag",
      status: "skipped",
      note: "Sheet handle not found (mobile shell may not be active or listings empty).",
    };
  }

  const box = await handle.boundingBox();
  if (!box) {
    return { scenario: "Bottom_Sheet drag", status: "skipped", note: "Sheet handle has no layout box." };
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await startRecording(page);

  // Drag up (expand) in small increments so the sheet updates each frame.
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= 30; step += 1) {
    await page.mouse.move(startX, startY - step * 12, { steps: 2 });
    await page.waitForTimeout(16);
  }
  // Drag back down.
  for (let step = 30; step >= 1; step -= 1) {
    await page.mouse.move(startX, startY - step * 12, { steps: 2 });
    await page.waitForTimeout(16);
  }
  await page.mouse.up();

  await page.waitForTimeout(400); // let the settle animation run
  const { timestamps, longTasks } = await stopRecording(page);

  return measuredReport("Bottom_Sheet drag", timestamps, longTasks);
}

async function profileClickInteraction(
  page: Page,
  scenario: string,
  selector: string,
  settleMs = 500,
): Promise<ScenarioReport> {
  const target = page.locator(selector).first();
  if (!(await target.isVisible().catch(() => false))) {
    return { scenario, status: "skipped", category: "application-motion", note: `Trigger not available: ${selector}` };
  }

  await startRecording(page);
  await target.click();
  await page.waitForTimeout(settleMs);
  const { timestamps, longTasks } = await stopRecording(page);
  return measuredReport(scenario, timestamps, longTasks);
}

async function profileRouteTransition(page: Page): Promise<ScenarioReport> {
  const links = page.locator('a[href^="/"]:visible');
  const currentPath = new URL(page.url()).pathname;
  const count = await links.count();
  for (let index = 0; index < count; index += 1) {
    const link = links.nth(index);
    const href = await link.getAttribute("href");
    if (!href || href.split("?")[0] === currentPath) continue;
    return profileClickInteraction(page, "Route transition", `a[href="${href}"]:visible`, 600);
  }
  return { scenario: "Route transition", status: "skipped", category: "application-motion", note: "No visible internal route link found." };
}

async function profileFilterReflow(page: Page): Promise<ScenarioReport> {
  const typeButton = page.getByRole("button", { name: /^Type/ }).first();
  if (!(await typeButton.isVisible().catch(() => false))) {
    return { scenario: "Filter/reflow", status: "skipped", category: "application-motion", note: "Type filter not visible." };
  }
  await typeButton.click();
  return profileClickInteraction(page, "Filter/reflow", 'label:has-text("Apartment")', 700);
}

async function openPage(browser: Browser, mobile: boolean): Promise<Page> {
  const context = mobile
    ? await browser.newContext({ ...devices["Pixel 7"] })
    : await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript({ content: FRAME_RECORDER_SOURCE });
  await page.goto(BASE_URL, { waitUntil: "networkidle" }).catch(async () => {
    // networkidle can never settle if the map SDK keeps polling; fall back.
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  });
  // Give the client bundle + map a moment to hydrate and paint.
  await page.waitForTimeout(2_500);
  return page;
}

async function main(): Promise<void> {
  console.log("Interaction frame-rate profiling harness (Req 10.1, 10.2, 10.4, 10.6)");
  console.log(`Target: ${BASE_URL}`);
  console.log("Measured values only — not asserted as a build gate.\n");

  let browser: Browser | undefined;
  const reports: ScenarioReport[] = [];

  try {
    browser = await chromium.launch({ headless: !HEADED });

    // Desktop pass: map work is reported separately from application-owned motion.
    const desktopPage = await openPage(browser, false);
    reports.push(await profileMapPanZoom(desktopPage));
    reports.push(await profileFilterReflow(desktopPage));
    reports.push(await profileClickInteraction(desktopPage, "Modal open", 'button:has-text("Apply now")'));
    reports.push(await profileClickInteraction(desktopPage, "Gallery zoom", 'button[aria-label^="Open gallery"]'));
    await desktopPage.context().close();

    const routePage = await openPage(browser, false);
    reports.push(await profileRouteTransition(routePage));
    await routePage.context().close();

    const messagePage = await openPage(browser, false);
    await messagePage.goto(`${BASE_URL}/messages`, { waitUntil: "domcontentloaded" });
    reports.push(await profileClickInteraction(messagePage, "Message entry", 'textarea[placeholder*="message" i], input[placeholder*="message" i]'));
    await messagePage.context().close();

    // Mobile pass: Bottom_Sheet drag lives in the mobile shell.
    const mobilePage = await openPage(browser, true);
    reports.push(await profileSheetDrag(mobilePage));
    await mobilePage.context().close();
  } catch (error) {
    console.error("\nHarness could not run against the target.");
    console.error(error instanceof Error ? error.message : error);
    console.error(
      "\nEnsure the app is running (e.g. `npm run build && npm run start`) or set FRAME_PROFILE_URL.",
    );
    process.exitCode = 1;
    return;
  } finally {
    await browser?.close();
  }

  console.log("\n=== Measured interaction frame budgets ===\n");
  for (const report of reports) {
    if (report.status === "skipped" || !report.frames || !report.longTasks) {
      console.log(`▷ ${report.scenario}: SKIPPED — ${report.note ?? "no data"}\n`);
      continue;
    }
    console.log(formatSummary(report.scenario, report.frames, report.longTasks));
    if (report.category === "map-cold-load") {
      console.log("    gate              : informational (map cold-loading is profiled separately)");
    } else if (report.acceptance) {
      console.log(`    motion acceptance : ${report.acceptance.passed ? "PASS" : "FAIL"} (>=60 FPS, p95 <=16.7ms, no long task >50ms)`);
    }
    console.log("");
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    target: BASE_URL,
    note: "Measured lab values (hardware/refresh-rate dependent); not a build gate.",
    scenarios: reports,
  };

  mkdirSync(scriptDir, { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Report written to ${reportPath}`);
}

void main();
