// Feature: mobile-map-discovery, Property 3
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { SHEET_MAX_RATIO, SHEET_MIN_RATIO } from "./constants";
import { clampSheetHeight } from "./sheet";

describe("clampSheetHeight", () => {
  // Property 3: Sheet height clamp stays within bounds
  // Validates: Requirements 4.4, 4.5, 4.6
  it("P3 clamps any candidate to within [0.25*vh, 0.90*vh] and passes through in-range values", () => {
    fc.assert(
      fc.property(
        // Candidate may be negative, zero, or huge.
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        // Viewport height must be positive and realistic.
        fc.double({ min: 200, max: 1e6, noNaN: true }),
        (candidate, vh) => {
          const min = SHEET_MIN_RATIO * vh;
          const max = Math.min(SHEET_MAX_RATIO * vh, vh - 140);
          const result = clampSheetHeight(candidate, vh);

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
