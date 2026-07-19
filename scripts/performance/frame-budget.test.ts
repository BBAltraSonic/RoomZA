import { describe, expect, it } from "vitest";

import {
  FRAME_BUDGETS,
  computeFrameIntervals,
  formatSummary,
  summarizeFrames,
  summarizeLongTasks,
} from "./frame-budget";

describe("FRAME_BUDGETS", () => {
  it("encodes the 60 FPS and 120 FPS per-frame ceilings", () => {
    expect(FRAME_BUDGETS.fps60Ms).toBeCloseTo(16.667, 3);
    expect(FRAME_BUDGETS.fps120Ms).toBeCloseTo(8.333, 3);
  });
});

describe("computeFrameIntervals", () => {
  it("returns the deltas between consecutive timestamps", () => {
    expect(computeFrameIntervals([0, 16, 33, 50])).toEqual([16, 17, 17]);
  });

  it("drops non-positive and non-finite deltas", () => {
    expect(computeFrameIntervals([100, 100, 90, 116])).toEqual([26]);
    expect(computeFrameIntervals([0, Number.NaN, 16])).toEqual([]);
  });

  it("returns an empty array for fewer than two timestamps", () => {
    expect(computeFrameIntervals([])).toEqual([]);
    expect(computeFrameIntervals([42])).toEqual([]);
  });
});

describe("summarizeFrames", () => {
  it("reports a clean 60 FPS run as within budget", () => {
    // 61 timestamps, 16.6 ms apart → 60 intervals, all within the 16.667 ms
    // 60 FPS budget (just under), but above the 8.333 ms 120 FPS budget.
    const timestamps = Array.from({ length: 61 }, (_, i) => i * 16.6);
    const summary = summarizeFrames(timestamps);

    expect(summary.frameCount).toBe(60);
    expect(summary.effectiveFps).toBeCloseTo(60.24, 1);
    expect(summary.over60Count).toBe(0);
    expect(summary.over60Ratio).toBe(0);
    // 16.6 ms is above the 8.333 ms 120 FPS budget, so every frame misses it.
    expect(summary.over120Count).toBe(60);
    expect(summary.over120Ratio).toBe(1);
  });

  it("counts frames that exceed the 60 FPS budget", () => {
    // Two good frames, one janky 40 ms frame.
    const summary = summarizeFrames([0, 16, 32, 72]);
    expect(summary.frameCount).toBe(3);
    expect(summary.maxMs).toBe(40);
    expect(summary.over60Count).toBe(1);
    expect(summary.p50Ms).toBeGreaterThan(0);
  });

  it("returns a zeroed summary when there is no frame data", () => {
    const summary = summarizeFrames([]);
    expect(summary.frameCount).toBe(0);
    expect(summary.effectiveFps).toBe(0);
    expect(summary.over60Count).toBe(0);
    expect(summary.over120Count).toBe(0);
  });
});

describe("summarizeLongTasks", () => {
  it("totals blocking work and tracks the longest task", () => {
    const summary = summarizeLongTasks([
      { startMs: 10, durationMs: 60 },
      { startMs: 200, durationMs: 120 },
      { startMs: 500, durationMs: -5 }, // invalid, ignored in totals
    ]);
    expect(summary.count).toBe(3);
    expect(summary.totalMs).toBe(180);
    expect(summary.longestMs).toBe(120);
  });

  it("handles an empty sample set", () => {
    expect(summarizeLongTasks([])).toEqual({ count: 0, totalMs: 0, longestMs: 0 });
  });
});

describe("formatSummary", () => {
  it("renders both budgets in the human-readable report", () => {
    const summary = summarizeFrames([0, 16, 32, 48]);
    const longTasks = summarizeLongTasks([{ startMs: 0, durationMs: 55 }]);
    const text = formatSummary("Map pan", summary, longTasks);

    expect(text).toContain("Map pan");
    expect(text).toContain("60 FPS budget");
    expect(text).toContain("120 FPS budget");
    expect(text).toContain("main-thread work");
  });
});
