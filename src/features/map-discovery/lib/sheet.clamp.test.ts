// Feature: mobile-map-discovery, Property 3
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { SHEET_MIN_RATIO } from "./constants";
import { clampSheetHeight, fullHeight, peekHeight } from "./sheet";

describe("clampSheetHeight", () => {
  // Property 3: Sheet height clamp stays within bounds
  // Validates: Requirements 4.4, 4.5, 4.6
  it("P3 clamps any candidate to within [collapsed, expanded] and passes through in-range values", () => {
    fc.assert(
      fc.property(
        // Candidate may be negative, zero, or huge.
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        // Viewport height must be positive and realistic.
        fc.double({ min: 240, max: 1e6, noNaN: true }),
        (candidate, vh) => {
          const min = peekHeight(vh);
          const max = fullHeight(vh);
          const result = clampSheetHeight(candidate, vh);

          // Bounds are ordered and the min matches the collapsed ratio.
          expect(min).toBe(SHEET_MIN_RATIO * vh);
          expect(min).toBeLessThanOrEqual(max);

          // Result is always within bounds.
          expect(result).toBeGreaterThanOrEqual(min);
          expect(result).toBeLessThanOrEqual(max);

          if (candidate < min) {
            // Candidates below the minimum clamp up to the min bound.
            expect(result).toBe(min);
          } else if (candidate > max) {
            // Candidates above the maximum clamp down to the max bound.
            expect(result).toBe(max);
          } else {
            // In-range candidates pass through unchanged.
            expect(result).toBe(candidate);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
