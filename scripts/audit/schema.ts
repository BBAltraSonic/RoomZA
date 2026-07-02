/**
 * Gap_Report data models for the Production Readiness & Launch Hardening audit.
 *
 * These Zod schemas make the Gap_Report self-validating: the Readiness_Audit
 * (Phase 1) emits entries that conform to {@link GapEntry}, per-spec results that
 * conform to {@link SpecResult}, and the schemas' refinements enforce the
 * invariants required by Requirements 1.1, 1.2, 1.4, 1.6, 1.8, 1.10, and 12.3.
 *
 * @see .kiro/specs/production-readiness-hardening/design.md — "Data Models"
 */
import { createHash } from "node:crypto";
import { z } from "zod";

/** Severity assigned to every gap (R1.8). */
export const Severity = z.enum(["blocker", "major", "minor"]);
export type Severity = z.infer<typeof Severity>;

/**
 * Owning phase for a gap — identified by its Requirement number in the range
 * Requirement 2 through Requirement 8 (R1.8). `null` is permitted only for
 * `audit-incomplete` entries (enforced by the {@link GapEntry} refinement).
 */
export const OwningPhase = z.union([
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
    z.literal(8),
]);
export type OwningPhase = z.infer<typeof OwningPhase>;

/** Gap categories emitted by the audit collectors. */
export const GapCategory = z.enum([
    "missing-feature", // R1.2
    "placeholder", // R1.3
    "missing-route-state", // R1.4
    "missing-validation", // R1.5
    "missing-observability", // R1.6
    "dead-code", // R1.7
    "architecture", // R2.x
    "db-integrity", // R9.x
    "in-progress-spec", // R1.9, R12
    "audit-incomplete", // R1.10, R12.3
]);
export type GapCategory = z.infer<typeof GapCategory>;

/** Which of the three required route states is absent (R1.4). */
export const MissingState = z.enum(["loading", "empty", "error"]);
export type MissingState = z.infer<typeof MissingState>;

/** Which of the three observability concerns is absent (R1.6). */
export const MissingObservability = z.enum(["analytics", "logging", "monitoring"]);
export type MissingObservability = z.infer<typeof MissingObservability>;

/** Resolution status of a gap; entries default to `open` when emitted. */
export const GapStatus = z.enum(["open", "resolved"]);
export type GapStatus = z.infer<typeof GapStatus>;

/**
 * A single discovered gap.
 *
 * Invariants (R1.2, R1.4, R1.6, R1.8, R1.10) are enforced via `.superRefine`:
 * - non-`audit-incomplete` entries have exactly one severity (guaranteed by the
 *   enum) AND exactly one `owningPhase` in 2–8 (non-null);
 * - `audit-incomplete` entries have a non-null `reason` and a null `owningPhase`;
 * - `missing-feature` entries have a non-null `readmeRef` and empty `filePaths`;
 * - `missing-route-state` entries have a non-null `missingState`;
 * - `missing-observability` entries have a non-null `missingObservability`.
 */
export const GapEntry = z
    .object({
        /** Stable hash of {category, filePath, detail} — see {@link gapEntryId}. */
        id: z.string(),
        /** Affected feature/area. */
        feature: z.string(),
        /** README section heading or line number (R1.1, R1.2). */
        readmeRef: z.string().nullable(),
        /** Implementation path(s), or [] when the feature is "missing". */
        filePaths: z.array(z.string()),
        category: GapCategory,
        /** Exactly one severity (R1.8). */
        severity: Severity,
        /** Exactly one owning phase 2–8; null only for `audit-incomplete` (R1.8). */
        owningPhase: OwningPhase.nullable(),
        /** What is wrong / which state, field, or flag is absent. */
        detail: z.string(),
        /** Which route state is absent (R1.4). */
        missingState: MissingState.nullable(),
        /** Which observability concern is absent (R1.6). */
        missingObservability: MissingObservability.nullable(),
        /** Why the item could not be analysed (R1.10). */
        reason: z.string().nullable(),
        status: GapStatus.default("open"),
    })
    .superRefine((entry, ctx) => {
        if (entry.category === "audit-incomplete") {
            // R1.10: audit-incomplete entries must explain why, and carry no owning phase.
            if (entry.reason === null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["reason"],
                    message: "audit-incomplete entries must have a non-null reason (R1.10)",
                });
            }
            if (entry.owningPhase !== null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["owningPhase"],
                    message: "audit-incomplete entries must have a null owningPhase (R1.8)",
                });
            }
        } else {
            // R1.8: every non-audit-incomplete entry has exactly one owning phase in 2–8.
            if (entry.owningPhase === null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["owningPhase"],
                    message: "non-audit-incomplete entries must have an owningPhase in 2–8 (R1.8)",
                });
            }
        }

        if (entry.category === "missing-feature") {
            // R1.2: missing-feature entries reference the README and have no implementation path.
            if (entry.readmeRef === null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["readmeRef"],
                    message: "missing-feature entries must have a non-null readmeRef (R1.2)",
                });
            }
            if (entry.filePaths.length !== 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["filePaths"],
                    message: "missing-feature entries must have empty filePaths (R1.2)",
                });
            }
        }

        if (entry.category === "missing-route-state" && entry.missingState === null) {
            // R1.4: name which of loading/empty/error is absent.
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["missingState"],
                message: "missing-route-state entries must name the absent state (R1.4)",
            });
        }

        if (entry.category === "missing-observability" && entry.missingObservability === null) {
            // R1.6: name which of analytics/logging/monitoring is absent.
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["missingObservability"],
                message: "missing-observability entries must name the absent item (R1.6)",
            });
        }
    });
export type GapEntry = z.infer<typeof GapEntry>;

/** The four in-progress specs validated by the audit (R1.9, R12). */
export const SpecName = z.enum([
    "conversation-video-calling",
    "discovery-pop",
    "landlord-listing-management",
    "mobile-map-discovery",
]);
export type SpecName = z.infer<typeof SpecName>;

/** Pass/fail/not-applicable result for a single referenced acceptance criterion. */
export const CriteriaResult = z.object({
    /** Requirement identifier, e.g. "5.13". */
    requirement: z.string(),
    result: z.enum(["pass", "fail", "n/a"]),
});
export type CriteriaResult = z.infer<typeof CriteriaResult>;

/**
 * Per-spec audit result.
 *
 * Invariant (R12.3): a spec whose tasks list is missing/unreadable
 * (`tasksFileFound === false`) is never marked passed (`passed === false`).
 */
export const SpecResult = z
    .object({
        spec: SpecName,
        /** false → recorded as audit-incomplete and never passed (R12.3). */
        tasksFileFound: z.boolean(),
        ownTasks: z.object({ total: z.number(), incomplete: z.number() }),
        /** Per-criterion pass/fail (R12.1). */
        criteriaResults: z.array(CriteriaResult),
        /** Referenced criteria identifiers only — never duplicated (R12.4). */
        referencedCriteria: z.array(z.string()),
        passed: z.boolean(),
    })
    .superRefine((result, ctx) => {
        if (!result.tasksFileFound && result.passed) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["passed"],
                message: "a spec without a readable tasks list must never be marked passed (R12.3)",
            });
        }
    });
export type SpecResult = z.infer<typeof SpecResult>;

/**
 * Compute a stable identifier for a gap from its category, file path, and detail.
 *
 * The id is deterministic across runs so that re-running the audit re-derives
 * the same entry id for the same gap (the Gap_Report is a living artefact).
 *
 * @param input - the discriminating fields of the gap.
 * @returns a hex SHA-256 digest of the normalised input.
 */
export function gapEntryId(input: {
    category: GapCategory;
    /** Single implementation path, or empty string when the feature is missing. */
    filePath: string;
    detail: string;
}): string {
    // NUL separators avoid ambiguity between adjacent fields.
    const canonical = `${input.category}\u0000${input.filePath}\u0000${input.detail}`;
    return createHash("sha256").update(canonical).digest("hex");
}
