// Feature: mobile-map-discovery, Property 4
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { nearestSnap, snapHeights, snapToHeight, SHEET_SNAP_ORDER } from "./sheet";

describe("nearestSnap", () => {
  // Property 4: Sheet release snaps to exactly one of the three positions,
  // and that position is genuinely the nearest by height.
  // Validates: Requirements 4.7
  it("P4 resolved snap maps to exactly one of the three bound heights (the nearest)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -10_000, max: 10_000, noNaN: true }),
        fc.double({ min: 240, max: 20_000, noNaN: true }),
        (currentHeight, vh) => {
          const snap = nearestSnap(currentHeight, vh);
          const heights = snapHeights(vh);

          // snap is one of the three valid positions.
          expect(SHEET_SNAP_ORDER).toContain(snap);

          // The resolved height is exactly one of the three bound heights.
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
