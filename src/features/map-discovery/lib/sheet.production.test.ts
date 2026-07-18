// Feature: production-readiness-hardening, Property 12
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  clampSheetHeight,
  fullHeight,
  peekHeight,
  resolveSheetRelease,
  snapHeights,
  snapToHeight,
  SHEET_SNAP_ORDER,
} from "./sheet";

describe("production bottom-sheet bounds", () => {
  // Property 12: Bottom-sheet height always stays within bounds and snaps to a valid bound.
  // Validates: Requirements 6.12
  it("P12 clamps within [collapsed, expanded] and resolves drag release to one valid position", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10_000, max: 10_000, noNaN: true }),
        // Fling velocity in px/ms (negative = downward/collapsing).
        fc.double({ min: -10, max: 10, noNaN: true }),
        fc.double({ min: 240, max: 20_000, noNaN: true }),
        (endHeight, velocity, vh) => {
          const min = peekHeight(vh);
          const max = fullHeight(vh);
          const clamped = clampSheetHeight(endHeight, vh);

          expect(clamped).toBeGreaterThanOrEqual(min);
          expect(clamped).toBeLessThanOrEqual(max);

          const snap = resolveSheetRelease(endHeight, velocity, vh);
          const resolved = snapToHeight(snap, vh);
          const heights = snapHeights(vh);

          expect(SHEET_SNAP_ORDER).toContain(snap);
          expect(resolved).toBe(heights[snap]);
          expect(resolved).toBeGreaterThanOrEqual(min);
          expect(resolved).toBeLessThanOrEqual(max);
        },
      ),
      { numRuns: 100 },
    );
  });
});
