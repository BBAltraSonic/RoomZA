/**
 * Route-state collector (Phase 1, R1.4).
 *
 * Enumerates every reachable App Router route segment (a directory containing a
 * `page.tsx`) under `src/app` and, for each, detects whether it has a defined
 * **loading**, **empty**, and **error** state — either via an App Router
 * boundary file (`loading.tsx` / `error.tsx`, which apply to a segment and all
 * its descendants) or an in-component equivalent (a Suspense fallback / skeleton,
 * an empty-results branch, an error boundary / catch). For each of the three
 * states that is absent it emits one `missing-route-state` Gap_Report entry,
 * recording exactly which state is missing in `missingState` (R1.4).
 *
 * API route handlers (`route.ts`) are intentionally excluded — they are not
 * user-facing rendered routes and have no loading/empty/error UI states.
 *
 * Per the design grounding, no `loading.tsx` / `error.tsx` boundary files
 * currently exist anywhere under `src/app`, so this collector flags the
 * loading and error states of every route that also lacks an in-component
 * equivalent.
 *
 * @see .kiro/specs/production-readiness-hardening/design.md — "Readiness_Audit collectors"
 * _Requirements: 1.4_
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { assignSeverityAndPhase } from "../severity";
import { gapEntryId, OwningPhase, type GapEntry, type MissingState } from "../schema";

/** Options for {@link collectRouteStates}, primarily to support fixture trees in tests. */
export interface RouteStatesOptions {
    /** Absolute path to the `src/app` directory to scan. Defaults to `<repoRoot>/src/app`. */
    appDir?: string;
    /** Absolute repo root used to compute report-relative file paths. Defaults to `process.cwd()`. */
    repoRoot?: string;
}

/** The three route states the audit requires every reachable route to define (R1.4). */
const REQUIRED_STATES: readonly MissingState[] = ["loading", "empty", "error"];

/** A discovered route segment: the directory that owns a `page` file. */
interface RouteSegment {
    /** Absolute path to the segment directory. */
    dirAbs: string;
    /** Absolute path to the segment's `page` file. */
    pageAbs: string;
}

/** Source file extensions a route page or co-located component may use. */
const PAGE_BASENAMES = ["page.tsx", "page.ts", "page.jsx", "page.js"] as const;
const LOADING_BASENAMES = ["loading.tsx", "loading.ts", "loading.jsx", "loading.js"] as const;
const ERROR_BASENAMES = ["error.tsx", "error.ts", "error.jsx", "error.js"] as const;

/** True when `name` is one of the candidate basenames (case-sensitive, as on disk). */
function isOneOf(name: string, candidates: readonly string[]): boolean {
    return candidates.includes(name);
}

/** True when the entry at `abs` exists and is a directory. */
function isDirectory(abs: string): boolean {
    try {
        return statSync(abs).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Recursively collect every route segment (directory containing a page file)
 * under `appDir`, and record which directories contain `loading`/`error`
 * boundary files. The `api` subtree is skipped — those are route handlers.
 */
function walk(
    dirAbs: string,
    appDir: string,
    out: {
        segments: RouteSegment[];
        loadingDirs: Set<string>;
        errorDirs: Set<string>;
    },
): void {
    let entries: string[];
    try {
        entries = readdirSync(dirAbs);
    } catch {
        return;
    }

    let pageAbs: string | null = null;
    const childDirs: string[] = [];

    for (const name of entries) {
        const abs = path.join(dirAbs, name);

        // A route special-file name takes precedence over directory recursion.
        // Recording the page even when the matched entry is *not* a regular file
        // (e.g. a malformed page that is itself a directory) lets the collector
        // self-report it as unanalysable rather than silently skip it (R1.10).
        if (pageAbs === null && isOneOf(name, PAGE_BASENAMES)) {
            pageAbs = abs;
            continue;
        }

        if (isDirectory(abs)) {
            // Skip API route handlers — not user-facing rendered routes.
            if (name === "api") {
                continue;
            }
            childDirs.push(abs);
            continue;
        }
        if (isOneOf(name, LOADING_BASENAMES)) {
            out.loadingDirs.add(dirAbs);
        }
        if (isOneOf(name, ERROR_BASENAMES)) {
            out.errorDirs.add(dirAbs);
        }
    }

    if (pageAbs !== null) {
        out.segments.push({ dirAbs, pageAbs });
    }

    for (const childAbs of childDirs) {
        walk(childAbs, appDir, out);
    }
}

/**
 * True when any ancestor directory of `dirAbs` up to and including `appDir`
 * is present in `boundaryDirs`. App Router `loading.tsx`/`error.tsx` boundaries
 * apply to the owning segment and all descendant segments, so an ancestor
 * boundary covers the route.
 */
function hasAncestorBoundary(dirAbs: string, appDir: string, boundaryDirs: Set<string>): boolean {
    let current = dirAbs;
    // Walk upward until we pass the app root.
    for (;;) {
        if (boundaryDirs.has(current)) {
            return true;
        }
        if (current === appDir) {
            return false;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return false;
        }
        current = parent;
    }
}

/** The concatenated segment source plus whether its page file could be read. */
interface SegmentSource {
    /** Concatenated page + co-located component source for signal detection. */
    readonly source: string;
    /** False when the segment's `page` file itself could not be read (R1.10). */
    readonly pageReadable: boolean;
}

/**
 * Read the page file plus any co-located source files in the same segment
 * directory (the components a page most commonly composes), concatenated into a
 * single blob for in-component signal detection. Test files are excluded.
 *
 * When the segment's own `page` file cannot be read (e.g. it is missing or
 * malformed), `pageReadable` is false so the collector can self-report the
 * route as unanalysable instead of silently skipping it (R1.10).
 */
function readSegmentSource(segment: RouteSegment): SegmentSource {
    const parts: string[] = [];
    let pageReadable = true;
    try {
        parts.push(readFileSync(segment.pageAbs, "utf8"));
    } catch {
        // Unreadable page — the route cannot be analysed (R1.10).
        pageReadable = false;
    }

    let siblings: string[] = [];
    try {
        siblings = readdirSync(segment.dirAbs);
    } catch {
        siblings = [];
    }

    for (const name of siblings) {
        if (!/\.(tsx|ts|jsx|js)$/.test(name)) {
            continue;
        }
        if (/\.(test|spec)\.[tj]sx?$/.test(name)) {
            continue;
        }
        const abs = path.join(segment.dirAbs, name);
        if (abs === segment.pageAbs) {
            continue;
        }
        if (isDirectory(abs)) {
            continue;
        }
        try {
            parts.push(readFileSync(abs, "utf8"));
        } catch {
            // Ignore unreadable co-located files.
        }
    }

    return { source: parts.join("\n"), pageReadable };
}

/** Detect an in-component loading equivalent: a Suspense fallback or a skeleton/pending indicator. */
function hasInComponentLoading(source: string): boolean {
    const suspenseWithFallback = /<Suspense\b[^>]*\bfallback\b/.test(source) || (/<Suspense\b/.test(source) && /\bfallback\s*=/.test(source));
    return (
        suspenseWithFallback ||
        /\b(LoadingSkeleton|Skeleton|Spinner|isLoading|isPending|isFetching)\b/.test(source)
    );
}

/** Detect an in-component empty-state equivalent: an explicit empty-results branch or primitive. */
function hasInComponentEmpty(source: string): boolean {
    return (
        /\bEmptyState\b/.test(source) ||
        /\bisEmpty\b/.test(source) ||
        /\bempty[-\s]?state\b/i.test(source) ||
        /\.length\s*===\s*0/.test(source) ||
        /\.length\s*<\s*1\b/.test(source) ||
        /\.length\s*\?/.test(source) ||
        /\bNo\s+(results|listings|applications|applicants|matches|items|messages|viewings|saved)\b/i.test(source)
    );
}

/** Detect an in-component error-state equivalent: an error boundary, error primitive, or catch handler. */
function hasInComponentError(source: string): boolean {
    return (
        /\bErrorBoundary\b/.test(source) ||
        /\bErrorState\b/.test(source) ||
        /\bonError\b/.test(source) ||
        /\bcatch\s*\(/.test(source) ||
        /\.catch\s*\(/.test(source)
    );
}

/**
 * Convert an absolute segment directory into a URL-like route path, used for
 * human-readable `feature`/`detail` text. Route groups `(group)` are stripped;
 * the app root maps to `/`.
 */
function toRoutePath(dirAbs: string, appDir: string): string {
    const rel = path.relative(appDir, dirAbs);
    if (rel === "" || rel === ".") {
        return "/";
    }
    const segments = rel
        .split(path.sep)
        .filter((s) => s.length > 0 && !(s.startsWith("(") && s.endsWith(")")));
    return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

/** Normalise an absolute path to a repo-relative POSIX path for the Gap_Report. */
function toReportPath(abs: string, repoRoot: string): string {
    return path.relative(repoRoot, abs).split(path.sep).join("/");
}

/** Human-readable phrasing of each absent state for the entry `detail`. */
const STATE_DETAIL: Readonly<Record<MissingState, string>> = {
    loading: "no loading state (no loading.tsx boundary and no in-component loading indicator)",
    empty: "no empty state (no in-component empty-results branch)",
    error: "no error state (no error.tsx boundary and no in-component error handling)",
};

/**
 * Enumerate reachable App Router routes under `src/app` and emit a
 * `missing-route-state` Gap_Report entry for each route that lacks a defined
 * loading, empty, or error state (R1.4). Each emitted entry sets `missingState`
 * to exactly one of loading/empty/error.
 *
 * Pure with respect to the filesystem snapshot: it reads but never mutates the
 * source tree.
 *
 * @param options - optional overrides for the scanned `appDir` and `repoRoot`.
 * @returns one `GapEntry` per (route, absent-state) pair, in deterministic order.
 */
export function collectRouteStates(options: RouteStatesOptions = {}): GapEntry[] {
    const repoRoot = options.repoRoot ?? process.cwd();
    const appDir = options.appDir ?? path.join(repoRoot, "src", "app");

    if (!isDirectory(appDir)) {
        return [];
    }

    const collected = {
        segments: [] as RouteSegment[],
        loadingDirs: new Set<string>(),
        errorDirs: new Set<string>(),
    };
    walk(appDir, appDir, collected);

    // Deterministic ordering by route file path.
    collected.segments.sort((a, b) => a.pageAbs.localeCompare(b.pageAbs));

    const entries: GapEntry[] = [];

    for (const segment of collected.segments) {
        const { source, pageReadable } = readSegmentSource(segment);
        const routePath = toRoutePath(segment.dirAbs, appDir);
        const reportPath = toReportPath(segment.pageAbs, repoRoot);

        // R1.10: a reachable route whose page file cannot be read cannot be
        // analysed for its loading/empty/error states. Self-report it as
        // `audit-incomplete` (file path + non-null reason, null owning phase)
        // rather than silently skipping it.
        if (!pageReadable) {
            const detail = `Route "${routePath}" could not be analysed: its page file (${reportPath}) could not be read.`;
            const reason = `Page file ${reportPath} for reachable route "${routePath}" could not be read; its loading/empty/error states cannot be determined.`;
            const { severity } = assignSeverityAndPhase({ category: "audit-incomplete", detail });
            entries.push({
                id: gapEntryId({ category: "audit-incomplete", filePath: reportPath, detail }),
                feature: `route ${routePath}`,
                readmeRef: null,
                filePaths: [reportPath],
                category: "audit-incomplete",
                severity,
                // audit-incomplete entries carry no owning phase (R1.8/R1.10).
                owningPhase: null,
                detail,
                missingState: null,
                missingObservability: null,
                reason,
                status: "open",
            });
            continue;
        }

        const hasLoading =
            hasAncestorBoundary(segment.dirAbs, appDir, collected.loadingDirs) ||
            hasInComponentLoading(source);
        const hasError =
            hasAncestorBoundary(segment.dirAbs, appDir, collected.errorDirs) ||
            hasInComponentError(source);
        // Empty state has no App Router boundary file — in-component only.
        const hasEmpty = hasInComponentEmpty(source);

        const present: Readonly<Record<MissingState, boolean>> = {
            loading: hasLoading,
            empty: hasEmpty,
            error: hasError,
        };

        for (const state of REQUIRED_STATES) {
            if (present[state]) {
                continue;
            }
            const detail = `Route "${routePath}" has ${STATE_DETAIL[state]}.`;
            const assignment = assignSeverityAndPhase({
                category: "missing-route-state",
                detail,
                missingState: state,
            });
            // A missing-route-state gap is always owned by phase 6 (UX), which is
            // within the Gap_Report schema's 2–8 range; validate to narrow the
            // severity module's wider 2–9 phase union to the schema's type.
            const owningPhase = OwningPhase.parse(assignment.owningPhase);
            entries.push({
                id: gapEntryId({ category: "missing-route-state", filePath: reportPath, detail }),
                feature: `route ${routePath}`,
                readmeRef: null,
                filePaths: [reportPath],
                category: "missing-route-state",
                severity: assignment.severity,
                owningPhase,
                detail,
                missingState: state,
                missingObservability: null,
                reason: null,
                status: "open",
            });
        }
    }

    return entries;
}
