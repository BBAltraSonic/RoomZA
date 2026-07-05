// Feature: discovery-page-experience, Property 6: Latest sort orders by descending creation timestamp
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { latestSort } from "./sort";

type DatedListing = {
  id: string;
  createdAt: string | null;
};

// Effective sort key used by latestSort: a missing timestamp is treated as the
// epoch (time 0). Mirrors the comparator exactly.
function effectiveTime(createdAt: string | null): number {
  return createdAt ? new Date(createdAt).getTime() : 0;
}

// Smart generator: each listing carries either a real ISO creation timestamp
// (constrained to the epoch..year-2100 range so the input stays in the
// intended space while still exercising ties and wide spreads) or a "missing"
// timestamp modeled as null / empty string, which must be treated as epoch and
// ordered last.
const MAX_TIME = Date.UTC(2100, 0, 1);

const createdAtArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.integer({ min: 0, max: MAX_TIME }).map((ms) => new Date(ms).toISOString()),
  fc.constant(null),
  fc.constant(""), // empty string is falsy -> treated as epoch, same as null
);

const datedListingsArb: fc.Arbitrary<DatedListing[]> = fc
  .array(createdAtArb, { minLength: 0, maxLength: 100 })
  .map((timestamps) =>
    timestamps.map((createdAt, index) => ({ id: `listing-${index}`, createdAt })),
  );

describe("latestSort", () => {
  // Property 6: Latest sort orders by descending creation timestamp.
  // Validates: Requirements 6.7
  it("P6 orders each timestamp >= the next (descending), nulls treated as epoch and last", () => {
    fc.assert(
      fc.property(datedListingsArb, (listings) => {
        const result = latestSort(listings);

        // Permutation: same multiset of ids, nothing dropped or duplicated.
        expect(result.map((item) => item.id).sort()).toEqual(
          listings.map((item) => item.id).sort(),
        );

        // Input is not mutated (new array returned).
        expect(listings.length).toBe(result.length);

        // Descending by effective creation time (missing -> epoch 0).
        for (let index = 1; index < result.length; index += 1) {
          expect(effectiveTime(result[index - 1]!.createdAt)).toBeGreaterThanOrEqual(
            effectiveTime(result[index]!.createdAt),
          );
        }

        // Missing timestamps (epoch) are ordered last: no item with a
        // determinable positive time may appear after a missing one.
        const lastDeterminableIndex = result.reduce(
          (last, item, index) => (effectiveTime(item.createdAt) > 0 ? index : last),
          -1,
        );
        for (let index = 0; index < result.length; index += 1) {
          if (effectiveTime(result[index]!.createdAt) === 0) {
            expect(index).toBeGreaterThan(lastDeterminableIndex);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
