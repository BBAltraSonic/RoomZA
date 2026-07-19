// Frame-budget math for the interaction frame-rate profiling harness
// (Discovery_Page_Experience, Req 10.1, 10.2, 10.4, 10.6).
//
// This module is intentionally pure and browser-free so it can be unit-tested
// in CI without launching a browser. The profiling harness
// (`profile-interaction-frames.ts`) feeds it the per-frame timestamps it
// records in-page and turns them into a measured summary.
//
// Per the design, these are MEASURED values, not asserted thresholds: real
// frame timing depends on the host hardware, GPU, and display refresh rate, so
// the harness reports how each interaction performed against the two
// Frame_Budgets rather than failing a build.

/** Per-frame render-time ceilings for the two target frame rates (Req 10.1, 10.2). */
export const FRAME_BUDGETS = {
  /** 60 FPS → 16.666… ms per frame. */
  fps60Ms: 1000 / 60,
  /** 120 FPS → 8.333… ms per frame. */
  fps120Ms: 1000 / 120,
} as const;

export type FrameBudgetSummary = {
  /** Number of frame intervals measured (rendered frames minus one). */
  frameCount: number;
  /** Total wall-clock span across the measured frames, in ms. */
  durationMs: number;
  /** Effective average frame rate across the run. */
  effectiveFps: number;
  /** Shortest / longest / mean frame interval in ms. */
  minMs: number;
  maxMs: number;
  meanMs: number;
  /** Interval percentiles in ms. */
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  /** Frames that exceeded the 60 FPS budget (16.7 ms) and their share [0, 1]. */
  over60Count: number;
  over60Ratio: number;
  /** Frames that exceeded the 120 FPS budget (8.3 ms) and their share [0, 1]. */
  over120Count: number;
  over120Ratio: number;
};

/**
 * Convert an ordered list of `requestAnimationFrame` timestamps into the
 * inter-frame intervals (ms). Non-positive or non-finite deltas are dropped so
 * a paused tab or duplicate timestamp cannot corrupt the summary.
 */
export function computeFrameIntervals(timestamps: readonly number[]): number[] {
  const intervals: number[] = [];
  for (let i = 1; i < timestamps.length; i += 1) {
    const prev = timestamps[i - 1];
    const cur = timestamps[i];
    if (prev === undefined || cur === undefined) continue;
    const delta = cur - prev;
    if (Number.isFinite(delta) && delta > 0) {
      intervals.push(delta);
    }
  }
  return intervals;
}

/** Nearest-rank percentile over an already-sorted ascending array. */
function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  const index = Math.min(sortedAsc.length - 1, Math.max(0, rank - 1));
  return sortedAsc[index] ?? 0;
}

/**
 * Summarize measured frame timestamps against both Frame_Budgets. The input is
 * the raw list of frame timestamps (ms) captured during one interaction.
 */
export function summarizeFrames(timestamps: readonly number[]): FrameBudgetSummary {
  const intervals = computeFrameIntervals(timestamps);
  const frameCount = intervals.length;

  if (frameCount === 0) {
    return {
      frameCount: 0,
      durationMs: 0,
      effectiveFps: 0,
      minMs: 0,
      maxMs: 0,
      meanMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      over60Count: 0,
      over60Ratio: 0,
      over120Count: 0,
      over120Ratio: 0,
    };
  }

  const sorted = [...intervals].sort((a, b) => a - b);
  const durationMs = intervals.reduce((sum, ms) => sum + ms, 0);
  const meanMs = durationMs / frameCount;
  const minMs = sorted[0] ?? 0;
  const maxMs = sorted[sorted.length - 1] ?? 0;

  const over60Count = intervals.filter((ms) => ms > FRAME_BUDGETS.fps60Ms).length;
  const over120Count = intervals.filter((ms) => ms > FRAME_BUDGETS.fps120Ms).length;

  return {
    frameCount,
    durationMs,
    effectiveFps: durationMs > 0 ? (frameCount / durationMs) * 1000 : 0,
    minMs,
    maxMs,
    meanMs,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    over60Count,
    over60Ratio: over60Count / frameCount,
    over120Count,
    over120Ratio: over120Count / frameCount,
  };
}

/** Long-task samples captured via the in-page PerformanceObserver. */
export type LongTaskSample = { startMs: number; durationMs: number };

export type LongTaskSummary = {
  count: number;
  totalMs: number;
  longestMs: number;
};

/**
 * Summarize main-thread long tasks (blocking work > 50 ms) observed during an
 * interaction. Long tasks are the primary cause of dropped frames, so they are
 * reported alongside the frame intervals as the per-frame "work" signal.
 */
export function summarizeLongTasks(samples: readonly LongTaskSample[]): LongTaskSummary {
  let totalMs = 0;
  let longestMs = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample.durationMs) || sample.durationMs <= 0) continue;
    totalMs += sample.durationMs;
    if (sample.durationMs > longestMs) longestMs = sample.durationMs;
  }
  return { count: samples.length, totalMs, longestMs };
}

/** Render a single interaction summary as human-readable lines. */
export function formatSummary(label: string, summary: FrameBudgetSummary, longTasks: LongTaskSummary): string {
  const pct = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;
  return [
    `▶ ${label}`,
    `    frames measured : ${summary.frameCount} over ${summary.durationMs.toFixed(0)} ms (≈ ${summary.effectiveFps.toFixed(1)} FPS)`,
    `    frame interval   : mean ${summary.meanMs.toFixed(2)} ms | p50 ${summary.p50Ms.toFixed(2)} ms | p95 ${summary.p95Ms.toFixed(2)} ms | p99 ${summary.p99Ms.toFixed(2)} ms | max ${summary.maxMs.toFixed(2)} ms`,
    `    60 FPS budget    : ${FRAME_BUDGETS.fps60Ms.toFixed(2)} ms — ${summary.over60Count} frame(s) over budget (${pct(summary.over60Ratio)})`,
    `    120 FPS budget   : ${FRAME_BUDGETS.fps120Ms.toFixed(2)} ms — ${summary.over120Count} frame(s) over budget (${pct(summary.over120Ratio)})`,
    `    main-thread work : ${longTasks.count} long task(s), ${longTasks.totalMs.toFixed(0)} ms total, longest ${longTasks.longestMs.toFixed(0)} ms`,
  ].join("\n");
}
