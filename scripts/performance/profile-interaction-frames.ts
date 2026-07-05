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
  note?: string;
  frames?: FrameBudgetSummary;
  longTasks?: LongTaskSummary;
};

/**
 * Instrumentation injected into the page: a requestAnimationFrame recorder plus
 * a PerformanceObserver for long tasks. Kept as a plain string-free function so
 * Playwright can serialize it into the page context.
 */
function installFrameRecorder(): void {
  const w = window as unknown as {
    __frameProfile?: {
      recording: boolean;
      timestamps: number[];
      longTasks: { startMs: number; durationMs: number }[];
      observer?: PerformanceObserver;
    };
  };

  if (w.__frameProfile) return;

  const state = {
    recording: false,
    timestamps: [] as number[],
    longTasks: [] as { startMs: number; durationMs: number }[],
    observer: undefined as PerformanceObserver | undefined,
  };
  w.__frameProfile = state;

  const tick = (now: number) => {
    if (!state.recording) return;
    state.timestamps.push(now);
    requestAnimationFrame(tick);
  };

  try {
    const observer = new PerformanceObserver((list) => {
      if (!state.recording) return;
      for (const entry of list.getEntries()) {
        state.longTasks.push({ startMs: entry.startTime, durationMs: entry.duration });
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
    state.observer = observer;
  } catch {
    // longtask observation is best-effort; some engines don't support it.
  }

  (w as unknown as { __frameProfileStart: () => void }).__frameProfileStart = () => {
    state.recording = true;
    state.timestamps = [];
    state.longTasks = [];
    requestAnimationFrame(tick);
  };

  (w as unknown as {
    __frameProfileStop: () => { timestamps: number[]; longTasks: { startMs: number; durationMs: number }[] };
  }).__frameProfileStop = () => {
    state.recording = false;
    return { timestamps: state.timestamps.slice(), longTasks: state.longTasks.slice() };
  };
}

async function startRecording(page: Page): Promise<void> {
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

  return {
    scenario: "Map pan/zoom",
    status: "measured",
    frames: summarizeFrames(timestamps),
    longTasks: summarizeLongTasks(longTasks),
  };
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

  return {
    scenario: "Bottom_Sheet drag",
    status: "measured",
    frames: summarizeFrames(timestamps),
    longTasks: summarizeLongTasks(longTasks),
  };
}

async function openPage(browser: Browser, mobile: boolean): Promise<Page> {
  const context = mobile
    ? await browser.newContext({ ...devices["Pixel 7"] })
    : await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(installFrameRecorder);
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

    // Desktop pass: map pan/zoom.
    const desktopPage = await openPage(browser, false);
    reports.push(await profileMapPanZoom(desktopPage));
    await desktopPage.context().close();

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
