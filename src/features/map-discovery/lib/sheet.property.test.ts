// Feature: discovery-page-experience, Property 10: Sheet height clamps within bounds and resolves to a valid snap
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  clampSheetHeight,
  collapsedHeight,
  expandedHeight,
  resolveSheetRelease,
  snapHeights,
  SHEET_PROJECTION_MS,
  SHEET_SNAP_ORDER,
} from "./sheet";

describe("clampSheetHeight + resolveSheetRelease", () => {
  // Property 10: Sheet height clamps within bounds and resolves to a valid snap.
  // Validates: Requirements 10.4, 13.1
  it("P10 clampSheetHeight always returns a value within [collapsed, expanded]", () => {
    fc.assert(
      fc.property(
        // Candidate height may be negative, zero, in-range, or far out of range.
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        // Viewport height is positive and realistic.
        fc.double({ min: 240, max: 1e6, noNaN: true }),
        (candidate, vh) => {
          const min = collapsedHeight(vh);
          const max = expandedHeight(vh);
          const result = clampSheetHeight(candidate, vh);

          // Bounds stay ordered.
          expect(min).toBeLessThanOrEqual(max);

          // Result is always within the valid range.
          expect(result).toBeGreaterThanOrEqual(min);
          expect(result).toBeLessThanOrEqual(max);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 10: Sheet height clamps within bounds and resolves to a valid snap.
  // Validates: Requirements 10.4, 13.1
  it("P10 resolveSheetRelease returns exactly one of the three snaps nearest the velocity-projected height", () => {
    fc.assert(
      fc.property(
        // Release height anywhere plausible (including out of bounds).
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        // Fling velocity in px/ms, positive (growing) or negative (shrinking).
        fc.double({ min: -10, max: 10, noNaN: true }),
        // Viewport height is positive and realistic.
        fc.double({ min: 240, max: 1e6, noNaN: true }),
        (endHeight, velocity, vh) => {
          const snap = resolveSheetRelease(endHeight, velocity, vh);

          // The resolved snap is exactly one of the three valid positions.
          expect(SHEET_SNAP_ORDER).toContain(snap);

          // It is the snap nearest the (independently computed) projected height.
          const heights = snapHeights(vh);
          const projected = clampSheetHeight(endHeight + velocity * SHEET_PROJECTION_MS, vh);
          const chosenDist = Math.abs(projected - heights[snap]);
          for (const candidate of SHEET_SNAP_ORDER) {
            expect(chosenDist).toBeLessThanOrEqual(Math.abs(projected - heights[candidate]));
          }

          // And the snap resolves to a height inside the valid range.
          const min = collapsedHeight(vh);
          const max = expandedHeight(vh);
          expect(heights[snap]).toBeGreaterThanOrEqual(min);
          expect(heights[snap]).toBeLessThanOrEqual(max);
        },
      ),
      { numRuns: 100 },
    );
  });
});
