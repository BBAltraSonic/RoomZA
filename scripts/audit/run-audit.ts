/**
 * Readiness_Audit orchestrator (Phase 1, R1).
 *
 * `runAudit()` is the single entry point that drives the entire Phase-1 audit:
 * it invokes every collector under `scripts/audit/collectors/`, aggregates the
 * resulting {@link GapEntry} records and per-spec {@link SpecResult}s, validates
 * each against the Gap_Report Zod schema (`scripts/audit/schema.ts`), stamps the
 * run with `generatedAt` (ISO now) and the `commit` it ran against, computes the
 * `byCategory` / `bySeverity` / `byOwningPhase` summary breakdowns, and writes
 * the two report artefacts to the spec directory:
 *
 *   - `gap-report.json` — the authoritative, machine-readable Gap_Report; and
 *   - `gap-report.md`   — a generated, human-readable rendering of the same data.
 *
 * The audit is a **read-only analyser of source**: the only files it ever writes
 * are the two report artefacts above. Re-running it re-derives both from the
 * current state of the tree, so the Gap_Report is a living artefact (design §2).
 *
 * Runnable via the project's Node 22 / tsx toolchain:
 *
 *   tsx scripts/audit/run-audit.ts
 *   node --experimental-strip-types scripts/audit/run-audit.ts
 *
 * @see .kiro/specs/production-readiness-hardening/design.md — "Readiness_Audit interface", "Gap_Report store"
 * _Requirements: 1.1, 1.8, 1.9, 1.10_
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectArchitecture } from "./collectors/architecture";
import { collectDbIntegrity } from "./collectors/db-integrity";
import { collectDeadCode } from "./collectors/dead-code";
import { collectInProgressSpecs } from "./collectors/in-progress-specs";
import { collectInputValidationGaps } from "./collectors/input-validation";
import { collectObservabilityGaps } from "./collectors/observability";
import { collectPlaceholders } from "./collectors/placeholders";
import { collectReadmeFeatures } from "./collectors/readme-features";
import { collectRouteStates } from "./collectors/route-states";
import {
    GapCategory,
    GapEntry,
    Severity,
    SpecResult,
    type OwningPhase,
} from "./schema";

/** Repo root resolved relative to this module (`<root>/scripts/audit`). */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The spec directory the Gap_Report artefacts are written to. */
const SPEC_DIR = path.join(REPO_ROOT, ".kiro", "specs", "production-readiness-hardening");

/** Authoritative machine-readable report path. */
const JSON_REPORT_PATH = path.join(SPEC_DIR, "gap-report.json");
/** Generated human-readable report path. */
const MARKDOWN_REPORT_PATH = path.join(SPEC_DIR, "gap-report.md");

/** Owning-phase summary keys: phases 2–8 plus a `null` bucket for audit-incomplete. */
export type OwningPhaseKey = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "null";

/** The aggregated summary breakdowns of the Gap_Report (R1.8). */
export interface AuditSummary {
    /** Count of entries per gap category. */
    readonly byCategory: Record<GapCategory, number>;
    /** Count of entries per severity. */
    readonly bySeverity: Record<Severity, number>;
    /** Count of entries per owning phase (`"null"` = audit-incomplete, no owning phase). */
    readonly byOwningPhase: Record<OwningPhaseKey, number>;
}

/** The complete result of a Readiness_Audit run (design "Readiness_Audit interface"). */
export interface AuditResult {
    /** ISO-8601 timestamp of when the audit ran. */
    readonly generatedAt: string;
    /** Git SHA the audit ran against, or `"unknown"` when it cannot be resolved. */
    readonly commit: string;
    /** Every discovered gap, validated against {@link GapEntry}. */
    readonly entries: GapEntry[];
    /** Per in-progress-spec results (R1.9, R12.1). */
    readonly specResults: SpecResult[];
    /** The summary breakdowns (R1.8). */
    readonly summary: AuditSummary;
}

/** The owning phases the Gap_Report schema permits (2–8). */
const OWNING_PHASES: readonly OwningPhase[] = [2, 3, 4, 5, 6, 7, 8];

/**
 * Resolve the git commit SHA the audit is running against. Falls back to
 * `"unknown"` (never throws) so the audit still produces a report in
 * environments without git (e.g. an exported tarball).
 */
function resolveCommit(): string {
    try {
        return execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: REPO_ROOT,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch {
        return "unknown";
    }
}

/** Build a zeroed `byCategory` record so every category appears even at count 0. */
function emptyCategoryCounts(): Record<GapCategory, number> {
    const counts = {} as Record<GapCategory, number>;
    for (const category of GapCategory.options) {
        counts[category] = 0;
    }
    return counts;
}

/** Build a zeroed `bySeverity` record so every severity appears even at count 0. */
function emptySeverityCounts(): Record<Severity, number> {
    const counts = {} as Record<Severity, number>;
    for (const severity of Severity.options) {
        counts[severity] = 0;
    }
    return counts;
}

/** Build a zeroed `byOwningPhase` record (phases 2–8 plus the `null` bucket). */
function emptyOwningPhaseCounts(): Record<OwningPhaseKey, number> {
    return { "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, null: 0 };
}

/**
 * Compute the three summary breakdowns from the validated entries (R1.8).
 * Every category, severity, and owning phase is present (initialised to 0) so
 * the summary shape is stable across runs regardless of which gaps were found.
 */
export function summarise(entries: readonly GapEntry[]): AuditSummary {
    const byCategory = emptyCategoryCounts();
    const bySeverity = emptySeverityCounts();
    const byOwningPhase = emptyOwningPhaseCounts();

    for (const entry of entries) {
        byCategory[entry.category] += 1;
        bySeverity[entry.severity] += 1;
        const phaseKey: OwningPhaseKey = entry.owningPhase === null ? "null" : (String(entry.owningPhase) as OwningPhaseKey);
        byOwningPhase[phaseKey] += 1;
    }

    return { byCategory, bySeverity, byOwningPhase };
}

/**
 * Run every collector, aggregate and de-duplicate their entries, and validate
 * each against the Gap_Report schema. Collectors are a mix of synchronous and
 * asynchronous functions; both are awaited uniformly. De-duplication is by the
 * stable {@link GapEntry.id} so the same gap reported by two passes appears once.
 */
async function collectAllEntries(): Promise<{ entries: GapEntry[]; specResults: SpecResult[] }> {
    const srcDir = path.join(REPO_ROOT, "src");
    const appDir = path.join(srcDir, "app");
    const migrationsDir = path.join(REPO_ROOT, "supabase", "migrations");
    const specsDir = path.join(REPO_ROOT, ".kiro", "specs");

    // Run the independent collectors concurrently. README + input-validation are
    // async (filesystem promises); the rest are synchronous and resolve immediately.
    const [
        readmeEntries,
        inputValidationEntries,
        placeholderEntries,
        routeStateEntries,
        observabilityEntries,
        deadCodeEntries,
        architectureEntries,
        dbIntegrityEntries,
    ] = await Promise.all([
        collectReadmeFeatures({ rootDir: REPO_ROOT }),
        collectInputValidationGaps({ srcDir, repoRoot: REPO_ROOT }),
        Promise.resolve(collectPlaceholders({ srcDir, repoRoot: REPO_ROOT })),
        Promise.resolve(collectRouteStates({ appDir, repoRoot: REPO_ROOT })),
        Promise.resolve(collectObservabilityGaps({ rootDir: REPO_ROOT })),
        Promise.resolve(collectDeadCode({ srcDir, repoRoot: REPO_ROOT })),
        Promise.resolve(collectArchitecture({ rootDir: REPO_ROOT })),
        Promise.resolve(collectDbIntegrity({ migrationsDir, repoRoot: REPO_ROOT })),
    ]);

    // in-progress-specs returns both Gap_Report entries and per-spec results.
    const inProgress = collectInProgressSpecs({ repoRoot: REPO_ROOT, specsDir });

    const rawEntries: GapEntry[] = [
        ...readmeEntries,
        ...placeholderEntries,
        ...routeStateEntries,
        ...inputValidationEntries,
        ...observabilityEntries,
        ...deadCodeEntries,
        ...architectureEntries,
        ...dbIntegrityEntries,
        ...inProgress.entries,
    ];

    // Validate every entry against the schema (R1.8/R1.10 invariants) and
    // de-duplicate by stable id, preserving first-seen order.
    const seen = new Set<string>();
    const entries: GapEntry[] = [];
    for (const raw of rawEntries) {
        const entry = GapEntry.parse(raw);
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        entries.push(entry);
    }

    // Deterministic ordering: category, then owning phase, then file path, then id.
    entries.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        const pa = a.owningPhase ?? 99;
        const pb = b.owningPhase ?? 99;
        if (pa !== pb) return pa - pb;
        const fa = a.filePaths[0] ?? "";
        const fb = b.filePaths[0] ?? "";
        if (fa !== fb) return fa.localeCompare(fb);
        return a.id.localeCompare(b.id);
    });

    // Validate every per-spec result (re-enforces R12.3).
    const specResults = inProgress.specResults.map((result) => SpecResult.parse(result));

    return { entries, specResults };
}

/**
 * Run the full Readiness_Audit and write the Gap_Report artefacts.
 *
 * @returns the {@link AuditResult} (also serialised to `gap-report.json`).
 */
export async function runAudit(): Promise<AuditResult> {
    const generatedAt = new Date().toISOString();
    const commit = resolveCommit();

    const { entries, specResults } = await collectAllEntries();
    const summary = summarise(entries);

    const result: AuditResult = { generatedAt, commit, entries, specResults, summary };

    writeReports(result);

    return result;
}

/**
 * Serialise the audit result to `gap-report.json` (authoritative) and render a
 * human-readable `gap-report.md` alongside it. The spec directory is created if
 * it does not yet exist. These are the only files the audit writes.
 */
export function writeReports(result: AuditResult): void {
    mkdirSync(SPEC_DIR, { recursive: true });
    writeFileSync(JSON_REPORT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    writeFileSync(MARKDOWN_REPORT_PATH, renderMarkdown(result), "utf8");
}

/** Render a Markdown summary table from a label→count record. */
function renderCountsTable(header: string, counts: Readonly<Record<string, number>>): string {
    const rows = Object.entries(counts)
        .filter(([, count]) => count > 0)
        .map(([label, count]) => `| ${label} | ${count} |`);
    if (rows.length === 0) {
        return `| _(none)_ | 0 |`;
    }
    return [`| ${header} | Count |`, "| --- | ---: |", ...rows].join("\n");
}

/** Escape Markdown table-breaking characters in free text. */
function escapeCell(text: string): string {
    return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/**
 * Render the human-readable `gap-report.md`. This is a generated view of the
 * authoritative `gap-report.json`; it is never the source of truth.
 */
export function renderMarkdown(result: AuditResult): string {
    const lines: string[] = [];

    lines.push("# Gap Report — Production Readiness & Launch Hardening");
    lines.push("");
    lines.push(
        "> Generated by `scripts/audit/run-audit.ts`. **Do not edit by hand** — " +
            "`gap-report.json` is the authoritative artefact; re-run the audit to regenerate both.",
    );
    lines.push("");
    lines.push(`- **Generated at:** ${result.generatedAt}`);
    lines.push(`- **Commit:** \`${result.commit}\``);
    lines.push(`- **Total gaps:** ${result.entries.length}`);
    lines.push("");

    lines.push("## Summary");
    lines.push("");
    lines.push("### By severity");
    lines.push("");
    lines.push(renderCountsTable("Severity", result.summary.bySeverity));
    lines.push("");
    lines.push("### By category");
    lines.push("");
    lines.push(renderCountsTable("Category", result.summary.byCategory));
    lines.push("");
    lines.push("### By owning phase");
    lines.push("");
    lines.push(renderCountsTable("Owning phase", result.summary.byOwningPhase));
    lines.push("");

    // In-progress spec results (R1.9, R12.1).
    lines.push("## In-progress specs");
    lines.push("");
    if (result.specResults.length === 0) {
        lines.push("_No in-progress specs evaluated._");
    } else {
        lines.push("| Spec | tasks.md | Tasks (incomplete/total) | Passed | Referenced criteria |");
        lines.push("| --- | --- | --- | --- | --- |");
        for (const spec of result.specResults) {
            const tasksFound = spec.tasksFileFound ? "found" : "**missing**";
            const passed = spec.passed ? "✅" : "❌";
            const criteria = spec.referencedCriteria.join(", ") || "—";
            lines.push(
                `| ${spec.spec} | ${tasksFound} | ${spec.ownTasks.incomplete}/${spec.ownTasks.total} | ${passed} | ${criteria} |`,
            );
        }
    }
    lines.push("");

    // Detailed entries grouped by owning phase.
    lines.push("## Gaps");
    lines.push("");
    if (result.entries.length === 0) {
        lines.push("_No gaps recorded._");
        lines.push("");
        return `${lines.join("\n")}\n`;
    }

    const phaseOrder: OwningPhaseKey[] = ["2", "3", "4", "5", "6", "7", "8", "null"];
    const phaseLabel: Record<OwningPhaseKey, string> = {
        "2": "Phase 2 — Architecture",
        "3": "Phase 3 — Auth flows",
        "4": "Phase 4 — Landlord flows",
        "5": "Phase 5 — Renter flows",
        "6": "Phase 6 — UX polish",
        "7": "Phase 7 — Performance",
        "8": "Phase 8 — Security",
        null: "Unassigned (audit-incomplete)",
    };

    for (const phaseKey of phaseOrder) {
        const phaseEntries = result.entries.filter(
            (entry) => (entry.owningPhase === null ? "null" : String(entry.owningPhase)) === phaseKey,
        );
        if (phaseEntries.length === 0) continue;

        lines.push(`### ${phaseLabel[phaseKey]} (${phaseEntries.length})`);
        lines.push("");
        lines.push("| Severity | Category | Feature | File(s) | Detail |");
        lines.push("| --- | --- | --- | --- | --- |");
        for (const entry of phaseEntries) {
            const files = entry.filePaths.length > 0 ? entry.filePaths.map((p) => `\`${p}\``).join("<br>") : "_(missing)_";
            lines.push(
                `| ${entry.severity} | ${entry.category} | ${escapeCell(entry.feature)} | ${files} | ${escapeCell(entry.detail)} |`,
            );
        }
        lines.push("");
    }

    return `${lines.join("\n")}\n`;
}

/**
 * CLI entry point: run the audit and print a one-line summary to stdout. Guarded
 * so importing this module (e.g. from a test) does not trigger a run.
 */
async function main(): Promise<void> {
    const result = await runAudit();
    process.stdout.write(
        `Readiness audit complete: ${result.entries.length} gap(s) recorded at commit ${result.commit}.\n` +
            `  → ${path.relative(REPO_ROOT, JSON_REPORT_PATH)}\n` +
            `  → ${path.relative(REPO_ROOT, MARKDOWN_REPORT_PATH)}\n`,
    );
}

// Run only when executed directly (tsx/node), never when imported.
const invokedDirectly =
    process.argv[1] !== undefined &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    main().catch((error: unknown) => {
        process.stderr.write(`Readiness audit failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
