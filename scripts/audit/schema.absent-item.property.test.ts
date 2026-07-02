// Feature: production-readiness-hardening, Property 3
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
    GapEntry,
    MissingObservability,
    MissingState,
    Severity,
    type GapCategory,
} from "./schema";

/**
 * Property 3: Route-state and observability gaps identify the absent item.
 *
 * For any Gap_Report, every `missing-route-state` entry names exactly one of
 * loading/empty/error, and every `missing-observability` entry names exactly
 * one of analytics/logging/monitoring. Conversely, the schema rejects such
 * entries when the relevant discriminator is null.
 *
 * Validates: Requirements 1.4, 1.6
 */

const severityArb = fc.constantFrom(...Severity.options);
// Non-audit-incomplete entries require a non-null owning phase in 2–8 (R1.8).
const owningPhaseArb = fc.constantFrom(2, 3, 4, 5, 6, 7, 8) as fc.Arbitrary<
    2 | 3 | 4 | 5 | 6 | 7 | 8
>;
const missingStateArb = fc.constantFrom(...MissingState.options);
const missingObservabilityArb = fc.constantFrom(...MissingObservability.options);

/**
 * Build a well-formed `missing-route-state` entry. `missingState` is supplied by
 * the caller so the same generator can produce both the valid (non-null) and the
 * invalid (null) variants.
 */
function routeStateEntry(missingState: ReturnType<typeof MissingState.parse> | null) {
    return fc.record({
        id: fc.string(),
        feature: fc.string(),
        readmeRef: fc.option(fc.string(), { nil: null }),
        filePaths: fc.array(fc.string(), { maxLength: 5 }),
        category: fc.constant("missing-route-state" as GapCategory),
        severity: severityArb,
        owningPhase: owningPhaseArb,
        detail: fc.string(),
        missingState: fc.constant(missingState),
        missingObservability: fc.constant(null),
        reason: fc.constant(null),
    });
}

/**
 * Build a well-formed `missing-observability` entry, parameterised on the
 * `missingObservability` discriminator (non-null for the valid case, null for
 * the rejection case).
 */
function observabilityEntry(
    missingObservability: ReturnType<typeof MissingObservability.parse> | null,
) {
    return fc.record({
        id: fc.string(),
        feature: fc.string(),
        readmeRef: fc.option(fc.string(), { nil: null }),
        filePaths: fc.array(fc.string(), { maxLength: 5 }),
        category: fc.constant("missing-observability" as GapCategory),
        severity: severityArb,
        owningPhase: owningPhaseArb,
        detail: fc.string(),
        missingState: fc.constant(null),
        missingObservability: fc.constant(missingObservability),
        reason: fc.constant(null),
    });
}

describe("GapEntry absent-item identification (Property 3)", () => {
    it("P3 every parsed missing-route-state entry names exactly one valid state", () => {
        fc.assert(
            fc.property(missingStateArb.chain((s) => routeStateEntry(s)), (raw) => {
                const entry = GapEntry.parse(raw);
                expect(entry.missingState).not.toBeNull();
                expect(MissingState.options).toContain(entry.missingState);
            }),
            { numRuns: 100 },
        );
    });

    it("P3 every parsed missing-observability entry names exactly one valid item", () => {
        fc.assert(
            fc.property(
                missingObservabilityArb.chain((o) => observabilityEntry(o)),
                (raw) => {
                    const entry = GapEntry.parse(raw);
                    expect(entry.missingObservability).not.toBeNull();
                    expect(MissingObservability.options).toContain(entry.missingObservability);
                },
            ),
            { numRuns: 100 },
        );
    });

    it("P3 rejects missing-route-state entries whose state discriminator is null", () => {
        fc.assert(
            fc.property(routeStateEntry(null), (raw) => {
                expect(GapEntry.safeParse(raw).success).toBe(false);
            }),
            { numRuns: 100 },
        );
    });

    it("P3 rejects missing-observability entries whose observability discriminator is null", () => {
        fc.assert(
            fc.property(observabilityEntry(null), (raw) => {
                expect(GapEntry.safeParse(raw).success).toBe(false);
            }),
            { numRuns: 100 },
        );
    });
});
