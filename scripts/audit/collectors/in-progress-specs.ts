/**
 * In-progress spec collector (Phase 1, R1.9, R12).
 *
 * Validates — but never re-specifies — the four in-progress feature specs
 * (`conversation-video-calling`, `discovery-pop`, `landlord-listing-management`,
 * `mobile-map-discovery`). For each spec it reads `tasks.md` (when present),
 * records the remaining incomplete tasks, and reports a pass/fail against that
 * spec's own task list and against the applicable Requirement 3–11 acceptance
 * criteria. Existing criteria are referenced **by identifier only** — never
 * duplicated or restated (R12.4).
 *
 * Two surfaces are produced (see {@link InProgressSpecsReport}):
 *  - `specResults` — one {@link SpecResult} per spec (R12.1): whether a tasks
 *    list was found, the own-task counts, the per-criterion pass/fail, the
 *    referenced criteria identifiers, and the overall `passed` flag.
 *  - `entries` — {@link GapEntry} records for the Gap_Report: one
 *    `in-progress-spec` entry for each incomplete launch-required task (with
 *    exactly one owning phase — R12.2/R1.8), plus one `audit-incomplete` entry
 *    for any spec whose `tasks.md` is missing or unreadable (with a non-null
 *    `reason` and a null `owningPhase` — R12.3/R1.10).
 *
 * Invariant (R12.3): a spec whose `tasks.md` cannot be read is recorded as
 * `audit-incomplete` and is **never** marked `passed`. This is enforced twice —
 * here (we set `passed: false` on that branch) and by {@link SpecResult}'s
 * refinement when each result is validated via `SpecResult.parse`.
 *
 * The collector is a read-only analyser: it never mutates spec source.
 *
 * @see .kiro/specs/production-readiness-hardening/design.md — "In-progress spec validation (R12)"
 * _Requirements: 1.9, 12.1, 12.2, 12.3, 12.4_
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    GapEntry,
    OwningPhase,
    SpecName,
    SpecResult,
    type CriteriaResult,
    gapEntryId,
} from "../schema";
import { assignSeverityAndPhase } from "../severity";

/** Repo root resolved relative to this module (`<root>/scripts/audit/collectors`). */
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Options for {@link collectInProgressSpecs} (overridable for tests/fixtures). */
export interface InProgressSpecsOptions {
    /** Repository root used to compute report-relative file paths. Defaults to the resolved repo root. */
    readonly repoRoot?: string;
    /** Directory holding the spec folders. Defaults to `<repoRoot>/.kiro/specs`. */
    readonly specsDir?: string;
}

/** What {@link collectInProgressSpecs} returns: per-spec results plus Gap_Report entries. */
export interface InProgressSpecsReport {
    /** One per spec — R12.1. */
    readonly specResults: SpecResult[];
    /** `in-progress-spec` and `audit-incomplete` Gap_Report entries — R1.9, R12.2, R12.3. */
    readonly entries: GapEntry[];
}

/**
 * Static, design-grounded configuration for each in-progress spec.
 *
 * `referencedCriteria` lists the applicable Requirement 3–11 acceptance criteria
 * **by identifier only** (R12.4) — the audit references existing criteria and
 * never duplicates their text. `owningPhase` is the single phase (2–8) that
 * closes any launch-required incomplete task for the spec (R12.2/R1.8).
 *
 * Grounding (design §10): `conversation-video-calling` validates against
 * R4.12/R5.13/R5.14 (the video-session criteria); `mobile-map-discovery` maps to
 * the UX phase (R6 touch/responsive criteria); `landlord-listing-management` to
 * the landlord phase; `discovery-pop` to the renter-discovery phase.
 */
interface SpecConfig {
    readonly spec: SpecName;
    /** Phase (2–8) that owns launch-required incomplete tasks for this spec. */
    readonly owningPhase: OwningPhase;
    /** Applicable R3–R11 acceptance-criteria identifiers, referenced not duplicated (R12.4). */
    readonly referencedCriteria: readonly string[];
}

const SPEC_CONFIGS: readonly SpecConfig[] = [
    { spec: "conversation-video-calling", owningPhase: 5, referencedCriteria: ["4.12", "5.13", "5.14"] },
    { spec: "discovery-pop", owningPhase: 5, referencedCriteria: ["5.1"] },
    { spec: "landlord-listing-management", owningPhase: 4, referencedCriteria: ["4.6", "4.7"] },
    { spec: "mobile-map-discovery", owningPhase: 6, referencedCriteria: ["6.7", "6.12", "6.13"] },
];

/** A single task checkbox parsed from a spec's `tasks.md`. */
export interface ParsedTask {
    /** Numeric task id (e.g. `"1"`, `"2.1"`), or `null` when the bullet has no id. */
    readonly id: string | null;
    /** The task title text following the id. */
    readonly title: string;
    /** True when the checkbox is ticked (`- [x]`). */
    readonly checked: boolean;
    /**
     * True when the bullet carries the optional marker (`- [ ]*`). Optional tasks
     * are skippable test sub-tasks — they are *not* required for launch and so
     * never become `in-progress-spec` gaps (R12.2).
     */
    readonly optional: boolean;
    /** 1-based line number of the bullet within `tasks.md`. */
    readonly line: number;
}

/**
 * Matches a Markdown task bullet at any indentation:
 *   `- [ ] ...`, `- [x] ...`, `- [ ]* ...`, `- [x]* ...` (case-insensitive `x`).
 * Captures: 1 = check char, 2 = optional `*` marker, 3 = the remaining text.
 */
const TASK_LINE = /^\s*-\s*\[([ xX])\](\*?)\s+(.*\S)\s*$/;

/** Extracts a leading numeric task id (e.g. `2.1`) and the title that follows it. */
const TASK_ID = /^(\d+(?:\.\d+)*)\.?\s+(.*)$/;

/**
 * Parse the task checkboxes from a `tasks.md` body.
 *
 * Pure over its input. Only Markdown task bullets are returned; prose, headings,
 * and notes are ignored. Line numbers are 1-based.
 */
export function parseTasks(markdown: string): ParsedTask[] {
    const tasks: ParsedTask[] = [];
    const lines = markdown.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i] ?? "";
        const match = TASK_LINE.exec(raw);
        if (!match) {
            continue;
        }

        const checkChar = match[1] ?? " ";
        const optional = (match[2] ?? "") === "*";
        const rest = match[3] ?? "";

        const idMatch = TASK_ID.exec(rest);
        const id = idMatch ? (idMatch[1] ?? null) : null;
        const title = idMatch ? (idMatch[2] ?? "").trim() : rest.trim();

        tasks.push({
            id,
            title,
            checked: checkChar.toLowerCase() === "x",
            optional,
            line: i + 1,
        });
    }

    return tasks;
}

/**
 * Validate each of the four in-progress specs against its `tasks.md` and the
 * applicable Requirement 3–11 criteria, producing per-spec {@link SpecResult}s
 * and Gap_Report {@link GapEntry}s.
 *
 * @param options - optional `repoRoot`/`specsDir` overrides (for tests/fixtures).
 * @returns the per-spec results and the derived Gap_Report entries.
 */
export function collectInProgressSpecs(options: InProgressSpecsOptions = {}): InProgressSpecsReport {
    const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
    const specsDir = options.specsDir ?? path.join(repoRoot, ".kiro", "specs");

    const specResults: SpecResult[] = [];
    const entries: GapEntry[] = [];

    for (const config of SPEC_CONFIGS) {
        const tasksAbs = path.join(specsDir, config.spec, "tasks.md");
        const relTasksPath = path.relative(repoRoot, tasksAbs).split(path.sep).join("/");
        // Reference criteria identifiers only — never duplicated (R12.4).
        const referencedCriteria = [...new Set(config.referencedCriteria)];

        let markdown: string | null = null;
        try {
            markdown = readFileSync(tasksAbs, "utf8");
        } catch {
            markdown = null;
        }

        // ── Missing / unreadable tasks list → audit-incomplete, never passed (R12.3). ──
        if (markdown === null) {
            const detail = `In-progress spec "${config.spec}" has no readable tasks list at ${relTasksPath}.`;
            const reason = `tasks.md is missing or unreadable for in-progress spec "${config.spec}"; the spec cannot be evaluated and is not marked passed (R12.3).`;
            const { severity } = assignSeverityAndPhase({ category: "audit-incomplete", detail });

            // GapEntry.parse enforces the audit-incomplete invariants (R1.10/R1.8):
            // non-null reason and null owningPhase.
            entries.push(
                GapEntry.parse({
                    id: gapEntryId({ category: "audit-incomplete", filePath: relTasksPath, detail }),
                    feature: config.spec,
                    readmeRef: null,
                    filePaths: [relTasksPath],
                    category: "audit-incomplete",
                    severity,
                    owningPhase: null,
                    detail,
                    missingState: null,
                    missingObservability: null,
                    reason,
                    status: "open",
                }),
            );

            // SpecResult.parse re-enforces R12.3: tasksFileFound === false ⇒ passed === false.
            specResults.push(
                SpecResult.parse({
                    spec: config.spec,
                    tasksFileFound: false,
                    ownTasks: { total: 0, incomplete: 0 },
                    criteriaResults: [],
                    referencedCriteria,
                    passed: false,
                }),
            );
            continue;
        }

        // ── Readable tasks list → evaluate tasks + criteria. ──
        const tasks = parseTasks(markdown);
        const incompleteTasks = tasks.filter((t) => !t.checked);
        // Launch-required = an incomplete task that is NOT an optional test sub-task (R12.2).
        const launchRequiredIncomplete = incompleteTasks.filter((t) => !t.optional);

        // One in-progress-spec gap per incomplete launch-required task, each with
        // exactly one owning phase (R1.9, R12.2/R1.8).
        for (const task of launchRequiredIncomplete) {
            const idLabel = task.id ? `task ${task.id}` : "an unnumbered task";
            const detail = `In-progress spec "${config.spec}" has an incomplete launch-required ${idLabel}: "${task.title}" (${relTasksPath}:${task.line}).`;
            const { severity } = assignSeverityAndPhase({
                category: "in-progress-spec",
                detail,
                feature: config.spec,
            });
            // Pin to the spec's configured phase; OwningPhase.parse narrows to the
            // schema's 2–8 range required for non-audit-incomplete entries.
            const owningPhase = OwningPhase.parse(config.owningPhase);

            entries.push(
                GapEntry.parse({
                    id: gapEntryId({ category: "in-progress-spec", filePath: relTasksPath, detail }),
                    feature: config.spec,
                    readmeRef: null,
                    filePaths: [relTasksPath],
                    category: "in-progress-spec",
                    severity,
                    owningPhase,
                    detail,
                    missingState: null,
                    missingObservability: null,
                    reason: null,
                    status: "open",
                }),
            );
        }

        // A criterion passes when no launch-required task remains incomplete; it
        // fails when launch-required work is outstanding (R12.1).
        const criteriaPass = launchRequiredIncomplete.length === 0;
        const criteriaResults: CriteriaResult[] = referencedCriteria.map((requirement) => ({
            requirement,
            result: criteriaPass ? "pass" : "fail",
        }));

        specResults.push(
            SpecResult.parse({
                spec: config.spec,
                tasksFileFound: true,
                ownTasks: { total: tasks.length, incomplete: incompleteTasks.length },
                criteriaResults,
                referencedCriteria,
                passed: criteriaPass,
            }),
        );
    }

    return { specResults, entries };
}
