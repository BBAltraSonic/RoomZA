// Feature: production-readiness-hardening, Task 4.3
import { describe, expect, it } from "vitest";

import { summarise, type OwningPhaseKey } from "./run-audit";
import {
    GapCategory,
    GapEntry,
    Severity,
    gapEntryId,
    type MissingObservability,
    type MissingState,
    type OwningPhase,
} from "./schema";

/**
 * Build a valid {@link GapEntry} from a partial spec, filling in schema-required
 * defaults and computing a stable id. Parsing through the schema guarantees the
 * constructed fixture honours every Gap_Report invariant, so the test inputs are
 * always well-formed.
 */
function makeEntry(input: {
    category: GapCategory;
    severity: Severity;
    owningPhase: OwningPhase | null;
    detail: string;
    feature?: string;
    readmeRef?: string | null;
    filePaths?: string[];
    missingState?: MissingState | null;
    missingObservability?: MissingObservability | null;
    reason?: string | null;
}): GapEntry {
    const filePath = input.filePaths?.[0] ?? "";
    return GapEntry.parse({
        id: gapEntryId({ category: input.category, filePath, detail: input.detail }),
        feature: input.feature ?? "feature",
        readmeRef: input.readmeRef ?? null,
        filePaths: input.filePaths ?? [],
        category: input.category,
        severity: input.severity,
        owningPhase: input.owningPhase,
        detail: input.detail,
        missingState: input.missingState ?? null,
        missingObservability: input.missingObservability ?? null,
        reason: input.reason ?? null,
    });
}

/** Owning-phase summary key for an entry (`"null"` bucket for audit-incomplete). */
function owningPhaseKey(entry: GapEntry): OwningPhaseKey {
    return entry.owningPhase === null ? "null" : (String(entry.owningPhase) as OwningPhaseKey);
}

/**
 * A fixture spanning multiple categories, all three severities, and several
 * owning phases — including two audit-incomplete entries with a null owning
 * phase, and intentional duplicate (category/severity/phase) combinations so the
 * counts must accumulate rather than overwrite.
 */
const ENTRIES: readonly GapEntry[] = [
    makeEntry({ category: "placeholder", severity: "blocker", owningPhase: 2, detail: "stub A", filePaths: ["src/a.ts"] }),
    makeEntry({ category: "placeholder", severity: "major", owningPhase: 3, detail: "stub B", filePaths: ["src/b.ts"] }),
    makeEntry({ category: "dead-code", severity: "minor", owningPhase: 2, detail: "unused C", filePaths: ["src/c.ts"] }),
    makeEntry({ category: "architecture", severity: "major", owningPhase: 2, detail: "boundary D", filePaths: ["src/d.ts"] }),
    makeEntry({
        category: "missing-feature",
        severity: "major",
        owningPhase: 4,
        detail: "no impl E",
        readmeRef: "README#payments",
    }),
    makeEntry({
        category: "missing-route-state",
        severity: "minor",
        owningPhase: 5,
        detail: "no loading F",
        filePaths: ["src/app/f/page.tsx"],
        missingState: "loading",
    }),
    makeEntry({
        category: "missing-observability",
        severity: "blocker",
        owningPhase: 8,
        detail: "no logging G",
        filePaths: ["src/g.ts"],
        missingObservability: "logging",
    }),
    makeEntry({ category: "audit-incomplete", severity: "minor", owningPhase: null, detail: "unreadable H", reason: "parse error" }),
    makeEntry({ category: "audit-incomplete", severity: "minor", owningPhase: null, detail: "timeout I", reason: "timed out" }),
];

describe("summarise — Gap_Report summary aggregation (R1.8)", () => {
    it("byCategory counts equal the entry counts grouped by category", () => {
        const { byCategory } = summarise(ENTRIES);

        // Independently group the entries by category.
        const expected = {} as Record<GapCategory, number>;
        for (const category of GapCategory.options) expected[category] = 0;
        for (const entry of ENTRIES) expected[entry.category] += 1;

        expect(byCategory).toEqual(expected);
        // The summed counts must account for every entry exactly once.
        expect(Object.values(byCategory).reduce((a, b) => a + b, 0)).toBe(ENTRIES.length);
    });

    it("bySeverity counts equal the entry counts grouped by severity", () => {
        const { bySeverity } = summarise(ENTRIES);

        const expected = {} as Record<Severity, number>;
        for (const severity of Severity.options) expected[severity] = 0;
        for (const entry of ENTRIES) expected[entry.severity] += 1;

        expect(bySeverity).toEqual(expected);
        expect(Object.values(bySeverity).reduce((a, b) => a + b, 0)).toBe(ENTRIES.length);
    });

    it("byOwningPhase counts equal the entry counts grouped by owning phase, with audit-incomplete in the null bucket", () => {
        const { byOwningPhase } = summarise(ENTRIES);

        const expected: Record<OwningPhaseKey, number> = {
            "2": 0,
            "3": 0,
            "4": 0,
            "5": 0,
            "6": 0,
            "7": 0,
            "8": 0,
            null: 0,
        };
        for (const entry of ENTRIES) expected[owningPhaseKey(entry)] += 1;

        expect(byOwningPhase).toEqual(expected);
        expect(Object.values(byOwningPhase).reduce((a, b) => a + b, 0)).toBe(ENTRIES.length);
        // The two audit-incomplete entries land in the null bucket.
        expect(byOwningPhase.null).toBe(2);
    });

    it("returns all-zero counts for an empty entry list", () => {
        const { byCategory, bySeverity, byOwningPhase } = summarise([]);

        expect(Object.values(byCategory).every((n) => n === 0)).toBe(true);
        expect(Object.values(bySeverity).every((n) => n === 0)).toBe(true);
        expect(Object.values(byOwningPhase).every((n) => n === 0)).toBe(true);
    });
});
