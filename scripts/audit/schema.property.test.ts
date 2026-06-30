// Feature: production-readiness-hardening, Property 1
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
    GapEntry,
    type GapCategory,
    type MissingObservability,
    type MissingState,
    type OwningPhase,
    type Severity,
} from "./schema";

const severityArb = fc.constantFrom<Severity>("blocker", "major", "minor");
const owningPhaseArb = fc.constantFrom<OwningPhase>(2, 3, 4, 5, 6, 7, 8);
const missingStateArb = fc.constantFrom<MissingState>("loading", "empty", "error");
const missingObservabilityArb = fc.constantFrom<MissingObservability>(
    "analytics",
    "logging",
    "monitoring",
);
const statusArb = fc.constantFrom("open", "resolved");

/** Categories that are not `audit-incomplete` and carry no extra field constraints. */
const plainCategoryArb = fc.constantFrom<GapCategory>(
    "placeholder",
    "missing-validation",
    "dead-code",
    "architecture",
    "db-integrity",
    "in-progress-spec",
);

/** Shared fields whose values are unconstrained by the refinements under test. */
const looseFields = () => ({
    id: fc.string(),
    feature: fc.string(),
    detail: fc.string(),
    status: statusArb,
});

/**
 * `audit-incomplete`: must carry a non-null `reason` and a null `owningPhase`;
 * every other field is unconstrained.
 */
const auditIncompleteArb = fc.record({
    ...looseFields(),
    category: fc.constant<GapCategory>("audit-incomplete"),
    severity: severityArb,
    owningPhase: fc.constant(null),
    reason: fc.string(),
    readmeRef: fc.option(fc.string(), { nil: null }),
    filePaths: fc.array(fc.string()),
    missingState: fc.option(missingStateArb, { nil: null }),
    missingObservability: fc.option(missingObservabilityArb, { nil: null }),
});

/** `missing-feature`: non-null `readmeRef`, empty `filePaths`, owning phase 2–8. */
const missingFeatureArb = fc.record({
    ...looseFields(),
    category: fc.constant<GapCategory>("missing-feature"),
    severity: severityArb,
    owningPhase: owningPhaseArb,
    reason: fc.option(fc.string(), { nil: null }),
    readmeRef: fc.string(),
    filePaths: fc.constant<string[]>([]),
    missingState: fc.option(missingStateArb, { nil: null }),
    missingObservability: fc.option(missingObservabilityArb, { nil: null }),
});

/** `missing-route-state`: non-null `missingState`, owning phase 2–8. */
const missingRouteStateArb = fc.record({
    ...looseFields(),
    category: fc.constant<GapCategory>("missing-route-state"),
    severity: severityArb,
    owningPhase: owningPhaseArb,
    reason: fc.option(fc.string(), { nil: null }),
    readmeRef: fc.option(fc.string(), { nil: null }),
    filePaths: fc.array(fc.string()),
    missingState: missingStateArb,
    missingObservability: fc.option(missingObservabilityArb, { nil: null }),
});

/** `missing-observability`: non-null `missingObservability`, owning phase 2–8. */
const missingObservabilityEntryArb = fc.record({
    ...looseFields(),
    category: fc.constant<GapCategory>("missing-observability"),
    severity: severityArb,
    owningPhase: owningPhaseArb,
    reason: fc.option(fc.string(), { nil: null }),
    readmeRef: fc.option(fc.string(), { nil: null }),
    filePaths: fc.array(fc.string()),
    missingState: fc.option(missingStateArb, { nil: null }),
    missingObservability: missingObservabilityArb,
});

/** Plain non-`audit-incomplete` categories: only the owning-phase constraint applies. */
const plainEntryArb = fc.record({
    ...looseFields(),
    category: plainCategoryArb,
    severity: severityArb,
    owningPhase: owningPhaseArb,
    reason: fc.option(fc.string(), { nil: null }),
    readmeRef: fc.option(fc.string(), { nil: null }),
    filePaths: fc.array(fc.string()),
    missingState: fc.option(missingStateArb, { nil: null }),
    missingObservability: fc.option(missingObservabilityArb, { nil: null }),
});

/** Any valid GapEntry across every category. */
const gapEntryArb = fc.oneof(
    auditIncompleteArb,
    missingFeatureArb,
    missingRouteStateArb,
    missingObservabilityEntryArb,
    plainEntryArb,
);

const SEVERITIES = ["blocker", "major", "minor"] as const;
const VALID_OWNING_PHASES = [2, 3, 4, 5, 6, 7, 8] as const;

describe("Gap_Report entry classification invariants", () => {
    // Property 1: Gap_Report entries are well-formed and fully classified.
    // Validates: Requirements 1.8, 1.10
    it("P1 every non-audit-incomplete entry has one severity + one owning phase 2–8, and every audit-incomplete entry has a reason", () => {
        fc.assert(
            fc.property(gapEntryArb, (candidate) => {
                // Generated entries are valid, so parsing must succeed (no refinement violations).
                const entry = GapEntry.parse(candidate);

                if (entry.category === "audit-incomplete") {
                    // R1.10: audit-incomplete entries must explain why they could not be analysed.
                    expect(entry.reason).not.toBeNull();
                } else {
                    // R1.8: exactly one severity from the closed three-value set.
                    expect(SEVERITIES).toContain(entry.severity);
                    // R1.8: exactly one owning phase, non-null and within 2–8.
                    expect(entry.owningPhase).not.toBeNull();
                    expect(VALID_OWNING_PHASES).toContain(entry.owningPhase as OwningPhase);
                }
            }),
            { numRuns: 100 },
        );
    });
});
