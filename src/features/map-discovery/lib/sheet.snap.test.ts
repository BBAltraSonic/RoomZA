// Feature: mobile-map-discovery, Property 4
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  browseHeight,
  fullHeight,
  nearestSnap,
  resolveSheetRelease,
  rubberBandSheetHeight,
  snapHeights,
  snapToHeight,
  SHEET_SNAP_ORDER,
  stepSnap,
} from "./sheet";

describe("two-state sheet", () => {
  it("only offers Browse and Full", () => {
    expect(SHEET_SNAP_ORDER).toEqual(["browse", "full"]);
  });

  it("settles a hard downward fling from Full on Browse, never lower", () => {
    const vh = 844;
    expect(resolveSheetRelease(fullHeight(vh), -10, vh)).toBe("browse");
    expect(resolveSheetRelease(0, -10, vh)).toBe("browse");
  });

  it("carries an upward fling from Browse to Full", () => {
    const vh = 844;
    expect(resolveSheetRelease(browseHeight(vh), 2, vh)).toBe("full");
  });

  it("steps between the two states and stops at each end", () => {
    expect(stepSnap("browse", "up")).toBe("full");
    expect(stepSnap("full", "down")).toBe("browse");
    expect(stepSnap("browse", "down")).toBe("browse");
    expect(stepSnap("full", "up")).toBe("full");
  });
});

describe("nearestSnap", () => {
  it("keeps Browse at 54% of the viewport across common phone heights", () => {
    for (const viewportHeight of [667, 844, 932]) {
      expect(browseHeight(viewportHeight)).toBeCloseTo(viewportHeight * 0.54);
    }
  });

  // Property 4: Sheet release snaps to exactly one of the two positions,
  // and that position is genuinely the nearest by height.
  // Validates: Requirements 4.7
  it("P4 resolved snap maps to exactly one of the two bound heights (the nearest)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10_000, max: 10_000, noNaN: true }),
        fc.double({ min: 240, max: 20_000, noNaN: true }),
        (currentHeight, vh) => {
          const snap = nearestSnap(currentHeight, vh);
          const heights = snapHeights(vh);

          // snap is one of the two valid positions.
          expect(SHEET_SNAP_ORDER).toContain(snap);

          // The resolved height is exactly one of the two bound heights.
          const resolved = snapToHeight(snap, vh);
          expect(resolved).toBe(heights[snap]);

          // No other position is strictly closer to the input height.
          const chosenDist = Math.abs(currentHeight - heights[snap]);
          for (const other of SHEET_SNAP_ORDER) {
            const otherDist = Math.abs(currentHeight - heights[other]);
            expect(chosenDist).toBeLessThanOrEqual(otherDist);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("rubberBandSheetHeight", () => {
  it("passes in-range heights through and resists overscroll at both bounds", () => {
    const vh = 800;
    const min = browseHeight(vh);
    const max = fullHeight(vh);

    expect(rubberBandSheetHeight((min + max) / 2, vh)).toBe((min + max) / 2);
    expect(rubberBandSheetHeight(min - 100, vh)).toBeLessThan(min);
    expect(rubberBandSheetHeight(min - 100, vh)).toBeGreaterThan(min - 100);
    expect(rubberBandSheetHeight(max + 100, vh)).toBeGreaterThan(max);
    expect(rubberBandSheetHeight(max + 100, vh)).toBeLessThan(max + 100);
  });
});
