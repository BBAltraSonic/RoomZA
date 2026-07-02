// Feature: production-readiness-hardening, Property 2
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { GapEntry, Severity, type GapCategory } from "./schema";

/**
 * Property 2: Missing-feature entries carry a README reference.
 *
 * For any Gap_Report, every entry with category `missing-feature` has a
 * non-null README reference (section heading or line number) and an empty
 * implementation-path list. Conversely, the schema rejects `missing-feature`
 * entries whose `readmeRef` is null or whose `filePaths` is non-empty.
 *
 * Validates: Requirements 1.1, 1.2
 */

const severityArb = fc.constantFrom(...Severity.options);
// Non-audit-incomplete entries require a non-null owning phase in 2–8 (R1.8).
const owningPhaseArb = fc.constantFrom(2, 3, 4, 5, 6, 7, 8) as fc.Arbitrary<
    2 | 3 | 4 | 5 | 6 | 7 | 8
>;

/**
 * Build a well-formed `missing-feature` entry: a non-null `readmeRef` and an
 * empty `filePaths` list, as required by R1.2.
 */
const validMissingFeatureEntry = fc.record({
    id: fc.string(),
    feature: fc.string(),
    readmeRef: fc.string(),
    filePaths: fc.constant([] as string[]),
    category: fc.constant("missing-feature" as GapCategory),
    severity: severityArb,
    owningPhase: owningPhaseArb,
    detail: fc.string(),
    missingState: fc.constant(null),
    missingObservability: fc.constant(null),
    reason: fc.constant(null),
});

/**
 * Build a malformed `missing-feature` entry. At least one of the two invariants
 * is violated: a null `readmeRef`, a non-empty `filePaths`, or both. The
 * generator constrains itself to the rejection space so every produced value is
 * genuinely invalid.
 */
const malformedMissingFeatureEntry = fc
    .record({
        nullRef: fc.boolean(),
        nonEmptyPaths: fc.boolean(),
    })
    .filter(({ nullRef, nonEmptyPaths }) => nullRef || nonEmptyPaths)
    .chain(({ nullRef, nonEmptyPaths }) =>
        fc.record({
            id: fc.string(),
            feature: fc.string(),
            readmeRef: nullRef ? fc.constant(null) : fc.string(),
            filePaths: nonEmptyPaths
                ? fc.array(fc.string(), { minLength: 1, maxLength: 5 })
                : fc.constant([] as string[]),
            category: fc.constant("missing-feature" as GapCategory),
            severity: severityArb,
            owningPhase: owningPhaseArb,
            detail: fc.string(),
            missingState: fc.constant(null),
            missingObservability: fc.constant(null),
            reason: fc.constant(null),
        }),
    );

describe("GapEntry missing-feature references (Property 2)", () => {
    it("P2 every parsed missing-feature entry has a non-null readmeRef and empty filePaths", () => {
        fc.assert(
            fc.property(validMissingFeatureEntry, (raw) => {
                const entry = GapEntry.parse(raw);
                expect(entry.category).toBe("missing-feature");
                expect(entry.readmeRef).not.toBeNull();
                expect(entry.filePaths).toEqual([]);
            }),
            { numRuns: 100 },
        );
    });

    it("P2 rejects malformed missing-feature entries (null readmeRef or non-empty filePaths)", () => {
        fc.assert(
            fc.property(malformedMissingFeatureEntry, (raw) => {
                expect(GapEntry.safeParse(raw).success).toBe(false);
            }),
            { numRuns: 100 },
        );
    });
});
