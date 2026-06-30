/**
 * Observability collector (Phase 1, R1.6).
 *
 * Scans every user-facing Server Action and API route and records, per file,
 * which of the three observability concerns is absent:
 *
 *   - **analytics**  — an `analytics_events` write (the project's analytics
 *                      mechanism) or a generic analytics/track call;
 *   - **logging**    — a structured `logger` call (`src/lib/logger.ts`);
 *   - **monitoring** — an error-monitoring/metrics call (Sentry capture,
 *                      metrics emit, etc.).
 *
 * For every concern that is absent in a scanned file, the collector emits one
 * Gap_Report entry with category `missing-observability`, `missingObservability`
 * set to exactly that one concern (never null — R1.6), and `filePaths` set to
 * the offending file path. Severity and owning phase come from the shared
 * deterministic assignment (`severity.ts`, R1.8).
 *
 * The collector is a read-only analyser: it never mutates application source.
 *
 * _Requirements: 1.6_
 * _Design: Readiness_Audit collectors — observability_
 */
import { readFileSync, readdirSync, statSync, type Dirent } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GapEntry, type MissingObservability, gapEntryId } from "../schema";
import { assignSeverityAndPhase } from "../severity";

/** The three observability concerns, in a stable order (R1.6). */
const OBSERVABILITY_CONCERNS: readonly MissingObservability[] = ["analytics", "logging", "monitoring"];

/** Repo root resolved relative to this module (`<root>/scripts/audit/collectors`). */
const DEFAULT_ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Options for {@link collectObservabilityGaps}. */
export interface ObservabilityCollectorOptions {
    /** Repository root to scan from. Defaults to the resolved repo root. */
    readonly rootDir?: string;
}

/** Whether a scanned file already covers each observability concern. */
export interface ObservabilityCoverage {
    readonly hasAnalytics: boolean;
    readonly hasLogging: boolean;
    readonly hasMonitoring: boolean;
}

/** The kind of user-facing entry point a scanned file represents. */
type EntryKind = "server-action" | "api-route";

interface ScanTarget {
    /** Absolute path on disk. */
    readonly absPath: string;
    /** Repo-root-relative path with forward slashes (used in the report). */
    readonly relPath: string;
    readonly kind: EntryKind;
}

const SKIP_DIRECTORIES = new Set([
    "node_modules",
    ".next",
    ".git",
    "dist",
    "build",
    "coverage",
]);

/** True for test/spec files, which are not user-facing entry points. */
function isTestFile(fileName: string): boolean {
    return /\.(test|spec)\.tsx?$/.test(fileName) || /\.property\.test\.tsx?$/.test(fileName);
}

/**
 * Strip comments from TypeScript source so that commented-out code and JSDoc
 * cannot be mistaken for live observability calls. Block comments are removed
 * first, then line comments — the line-comment pass deliberately skips `://`
 * (URLs) and `///` (triple-slash directives) to avoid corrupting string
 * literals on the same line.
 */
export function stripComments(source: string): string {
    const withoutBlock = source.replace(/\/\*[\s\S]*?\*\//g, " ");
    return withoutBlock.replace(/(?<![:/])\/\/.*$/gm, "");
}

const ANALYTICS_PATTERN = /analytics_events|\banalytics\s*\.|\btrack\s*\(|\blogEvent\s*\(|\bcaptureEvent\s*\(/;
const LOGGING_PATTERN = /\blogger\s*\.\s*(?:debug|info|warn|error|fatal)\s*\(/;
const MONITORING_PATTERN = /\bSentry\b|\bcaptureException\s*\(|\bcaptureMessage\s*\(|\bmetrics\s*\.|\bwithScope\s*\(|\brecordMetric\s*\(/;

/**
 * Determine, from a file's source, which observability concerns it already
 * covers. Pure over the (comment-stripped) input.
 */
export function analyzeObservability(source: string): ObservabilityCoverage {
    const code = stripComments(source);
    return {
        hasAnalytics: ANALYTICS_PATTERN.test(code),
        hasLogging: LOGGING_PATTERN.test(code),
        hasMonitoring: MONITORING_PATTERN.test(code),
    };
}

/** Whether the source declares a top-of-file `"use server"` directive. */
function hasUseServerDirective(source: string): boolean {
    const directive = /^\s*['"]use server['"]\s*;?\s*$/;
    let inspected = 0;
    for (const rawLine of source.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line === "") continue;
        if (directive.test(line)) return true;
        // The directive must precede any import/statement; bail after a few
        // significant lines so we don't scan an entire file.
        inspected += 1;
        if (inspected >= 3) return false;
    }
    return false;
}

/** Whether a `route.ts(x)` file sits under an `app` directory (App Router). */
function isApiRoute(relPath: string): boolean {
    const base = path.basename(relPath);
    if (base !== "route.ts" && base !== "route.tsx") return false;
    return relPath.split("/").includes("app");
}

/** Recursively collect Server Action and API-route files under `src`. */
function findScanTargets(rootDir: string): ScanTarget[] {
    const srcDir = path.join(rootDir, "src");
    const targets: ScanTarget[] = [];

    const walk = (dir: string): void => {
        let dirents: Dirent[];
        try {
            dirents = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const dirent of dirents) {
            const abs = path.join(dir, dirent.name);
            if (dirent.isDirectory()) {
                if (!SKIP_DIRECTORIES.has(dirent.name)) walk(abs);
                continue;
            }
            if (!dirent.isFile()) continue;
            if (!/\.tsx?$/.test(dirent.name) || isTestFile(dirent.name)) continue;

            const relPath = path.relative(rootDir, abs).split(path.sep).join("/");
            let source: string;
            try {
                source = readFileSync(abs, "utf8");
            } catch {
                continue;
            }

            if (isApiRoute(relPath)) {
                targets.push({ absPath: abs, relPath, kind: "api-route" });
            } else if (hasUseServerDirective(source)) {
                targets.push({ absPath: abs, relPath, kind: "server-action" });
            }
        }
    };

    if (safeIsDirectory(srcDir)) {
        walk(srcDir);
    }

    // Deterministic ordering so re-runs produce a stable report.
    return targets.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function safeIsDirectory(target: string): boolean {
    try {
        return statSync(target).isDirectory();
    } catch {
        return false;
    }
}

/** Derive a human-readable feature/area name from a repo-relative path. */
function deriveFeature(relPath: string): string {
    const segments = relPath.split("/");
    const featuresIdx = segments.indexOf("features");
    if (featuresIdx !== -1 && segments[featuresIdx + 1]) {
        return segments[featuresIdx + 1] as string;
    }
    const appIdx = segments.indexOf("app");
    if (appIdx !== -1) {
        const after = segments.slice(appIdx + 1, -1).filter((s) => !s.startsWith("("));
        if (after.length > 0) return after.join("/");
    }
    return path.basename(path.dirname(relPath));
}

/** Maps an absent concern to a human-readable label for the entry detail. */
const CONCERN_LABEL: Readonly<Record<MissingObservability, string>> = {
    analytics: "analytics instrumentation",
    logging: "structured logging",
    monitoring: "monitoring coverage",
};

/**
 * Scan the repository's Server Actions and API routes for absent observability
 * coverage and return one Gap_Report entry per (file, absent-concern) pair.
 *
 * @param options - optional scan root override (for tests/fixtures).
 * @returns validated `GapEntry[]`, each with category `missing-observability`
 *          and a non-null `missingObservability` naming the absent concern.
 */
export function collectObservabilityGaps(options: ObservabilityCollectorOptions = {}): GapEntry[] {
    const rootDir = options.rootDir ?? DEFAULT_ROOT_DIR;
    const entries: GapEntry[] = [];

    for (const target of findScanTargets(rootDir)) {
        const source = readFileSync(target.absPath, "utf8");
        const coverage = analyzeObservability(source);
        const present: Readonly<Record<MissingObservability, boolean>> = {
            analytics: coverage.hasAnalytics,
            logging: coverage.hasLogging,
            monitoring: coverage.hasMonitoring,
        };

        const kindLabel = target.kind === "api-route" ? "API route" : "Server Action";

        for (const concern of OBSERVABILITY_CONCERNS) {
            if (present[concern]) continue;

            const detail = `${kindLabel} lacks ${CONCERN_LABEL[concern]}`;
            const { severity, owningPhase } = assignSeverityAndPhase({
                category: "missing-observability",
                detail,
                missingObservability: concern,
            });

            entries.push(
                GapEntry.parse({
                    id: gapEntryId({
                        category: "missing-observability",
                        filePath: target.relPath,
                        detail,
                    }),
                    feature: deriveFeature(target.relPath),
                    readmeRef: null,
                    filePaths: [target.relPath],
                    category: "missing-observability",
                    severity,
                    owningPhase,
                    detail,
                    missingState: null,
                    missingObservability: concern,
                    reason: null,
                }),
            );
        }
    }

    return entries;
}
