/**
 * Placeholder & unimplemented-code-path collector (Phase 1, R1.3).
 *
 * Scans the `src/` tree and records, with file path, every:
 *   - TODO / FIXME marker;
 *   - not-implemented throw (`throw new Error("not implemented")` and variants);
 *   - commented-out logic (a line comment whose stripped body is real code); and
 *   - mock / hardcoded sample data source (mock/dummy/fake/sample data,
 *     hardcoded markers, lorem-ipsum filler).
 *
 * Every finding becomes a {@link GapEntry} with category `placeholder`, the
 * offending file path, and a `detail` naming the kind, line, and snippet. The
 * shared {@link assignSeverityAndPhase} rule sets severity/owning phase (R1.8)
 * and {@link gapEntryId} mints the stable id so re-running the audit re-derives
 * the same entry for the same gap.
 *
 * This is a read-only analyser — it never mutates application source.
 *
 * _Requirements: 1.3_
 * _Design: Readiness_Audit collectors — `placeholders.ts`_
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { gapEntryId, type GapEntry } from "../schema";
import { assignSeverityAndPhase } from "../severity";

/** The kinds of placeholder this collector detects. */
export type PlaceholderKind =
    | "todo-marker"
    | "not-implemented-throw"
    | "commented-out-logic"
    | "mock-data";

/** File extensions considered source code worth scanning. */
const SOURCE_EXTENSIONS: ReadonlySet<string> = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mts",
    ".cts",
    ".mjs",
    ".cjs",
]);

/** Directory names never descended into. */
const SKIP_DIRECTORIES: ReadonlySet<string> = new Set([
    "node_modules",
    ".next",
    ".git",
    "dist",
    "build",
    "coverage",
    "__tests__",
    "__mocks__",
]);

/** A single detected placeholder occurrence within a file. */
interface Finding {
    readonly kind: PlaceholderKind;
    /** 1-based line number of the occurrence. */
    readonly line: number;
    /** Trimmed source snippet, capped so details stay readable. */
    readonly snippet: string;
}

/** TODO / FIXME markers — case-sensitive to match the upper-case convention. */
const TODO_MARKER = /\b(TODO|FIXME)\b/;

/**
 * Not-implemented throws: `throw new Error("not implemented")` and the common
 * "not yet implemented" / "unimplemented" phrasings, in single or double quotes.
 */
const NOT_IMPLEMENTED_THROW =
    /throw\s+new\s+\w*Error\s*\(\s*[`'"][^`'"]*\b(not[\s-]?(yet[\s-]?)?implemented|unimplemented)\b/i;

/**
 * Mock / hardcoded sample-data signals. Deliberately specific to keep false
 * positives low (e.g. the bare word "placeholder" is excluded because it is
 * pervasive in input UI attributes).
 */
const MOCK_DATA_PATTERNS: readonly RegExp[] = [
    /\b(mock|dummy|fake|sample|hardcoded)[_-]?data\b/i,
    /\b(MOCK|DUMMY|FAKE|SAMPLE|HARDCODED|STUB)_[A-Z0-9_]+/,
    /\bhard[-\s]?coded\b/i,
    /\blorem\s+ipsum\b/i,
];

/**
 * Leading tokens that mark a `//` comment body as real (commented-out) code
 * rather than prose. Combined with a trailing-punctuation check below.
 */
const CODE_LEADING_KEYWORD =
    /^(const|let|var|return|if|else|for|while|switch|case|function|async|await|class|import|export|new|throw|try|catch|do|yield)\b/;

/** Comment bodies that look like code by their syntax even without a keyword. */
const CODE_SHAPED_EXPRESSION = /^[$A-Za-z_][\w.$]*\s*(?:=|\[|=>)/;

/**
 * Comment prefixes that are tooling directives or prose, never "logic", so they
 * must not be reported as commented-out code.
 */
const NON_LOGIC_COMMENT =
    /^(eslint-|@ts-|prettier-|biome-|c8\b|istanbul\b|@|https?:|todo\b|fixme\b|note\b|see\b|https?\b)/i;

/**
 * Detect commented-out logic on a `//` line comment.
 *
 * Heuristic: the comment body must look like code — either it starts with a
 * code keyword, or it begins like an expression/call/assignment.
 * Tooling directives, URLs, and TODO/FIXME prose are excluded so they are not
 * double-counted (TODO/FIXME is reported by its own detector).
 */
function isCommentedOutLogic(commentBody: string): boolean {
    const body = commentBody.trim();
    if (body.length === 0) return false;
    if (NON_LOGIC_COMMENT.test(body)) return false;
    if (TODO_MARKER.test(body)) return false; // reported separately
    return CODE_LEADING_KEYWORD.test(body) || CODE_SHAPED_EXPRESSION.test(body);
}

/** Cap snippet length so a single long line cannot bloat the report. */
function snippetOf(line: string): string {
    const trimmed = line.trim();
    return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
}

function lineCommentIndex(line: string): number {
    let quote: "'" | "\"" | "`" | null = null;
    let escaped = false;

    for (let i = 0; i < line.length - 1; i++) {
        const char = line[i];
        if (char === undefined) continue;

        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === "\\") {
            escaped = true;
            continue;
        }
        if (quote !== null) {
            if (char === quote) {
                quote = null;
            }
            continue;
        }
        if (char === "'" || char === "\"" || char === "`") {
            quote = char;
            continue;
        }
        if (char === "/" && line[i + 1] === "/") {
            return i;
        }
    }

    return -1;
}

/**
 * Scan a single file's contents and return every placeholder occurrence.
 *
 * Each line is classified by precedence: a TODO/FIXME or not-implemented throw
 * is reported as such; a `//` comment that is neither but looks like code is
 * reported as commented-out logic; mock-data signals are reported additionally
 * (a line may carry both a marker and mock data).
 */
export function findPlaceholdersInSource(contents: string): Finding[] {
    const findings: Finding[] = [];
    const lines = contents.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const lineNumber = i + 1;
        const snippet = snippetOf(line);

        let markerReported = false;

        if (TODO_MARKER.test(line)) {
            findings.push({ kind: "todo-marker", line: lineNumber, snippet });
            markerReported = true;
        }

        if (NOT_IMPLEMENTED_THROW.test(line)) {
            findings.push({ kind: "not-implemented-throw", line: lineNumber, snippet });
            markerReported = true;
        }

        // Commented-out logic: only consider `//` line comments, and only when
        // no higher-precedence marker already claimed this line.
        if (!markerReported) {
            const commentIndex = lineCommentIndex(line);
            if (commentIndex !== -1) {
                const body = line.slice(commentIndex + 2);
                if (isCommentedOutLogic(body)) {
                    findings.push({ kind: "commented-out-logic", line: lineNumber, snippet });
                }
            }
        }

        // Mock / hardcoded data can co-occur with any of the above.
        if (MOCK_DATA_PATTERNS.some((re) => re.test(line))) {
            findings.push({ kind: "mock-data", line: lineNumber, snippet });
        }
    }

    return findings;
}

/** True when a path looks like a test/spec file (excluded — mocks are expected there). */
function isTestFile(fileName: string): boolean {
    return /\.(test|spec)\.[cm]?[jt]sx?$/.test(fileName) || fileName.endsWith(".d.ts");
}

/** True when the file extension is a scannable source extension. */
function isSourceFile(fileName: string): boolean {
    const dot = fileName.lastIndexOf(".");
    if (dot === -1) return false;
    return SOURCE_EXTENSIONS.has(fileName.slice(dot));
}

/** Recursively collect scannable source file paths under `dir`. */
function collectSourceFiles(dir: string): string[] {
    const out: string[] = [];
    let dirents;
    try {
        dirents = readdirSync(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const dirent of dirents) {
        const full = join(dir, dirent.name);
        if (dirent.isDirectory()) {
            if (SKIP_DIRECTORIES.has(dirent.name)) continue;
            out.push(...collectSourceFiles(full));
        } else if (dirent.isFile()) {
            if (isTestFile(dirent.name)) continue;
            if (!isSourceFile(dirent.name)) continue;
            out.push(full);
        }
    }
    return out;
}

/** Human-readable label for each placeholder kind, used in `detail`. */
const KIND_LABEL: Readonly<Record<PlaceholderKind, string>> = {
    "todo-marker": "TODO/FIXME marker",
    "not-implemented-throw": "not-implemented throw",
    "commented-out-logic": "commented-out logic",
    "mock-data": "mock/hardcoded sample data",
};

/**
 * Derive a feature/area label from a repo-relative POSIX-ish path. Files under
 * `src/features/<domain>` are labelled by `<domain>`; otherwise the first path
 * segment beneath `src/` (e.g. `app`, `lib`, `components`) is used.
 */
function featureOf(relativePath: string): string {
    const segments = relativePath.split(/[\\/]/);
    const srcIndex = segments.indexOf("src");
    const base = srcIndex === -1 ? segments : segments.slice(srcIndex + 1);
    if (base[0] === "features" && base.length > 1) {
        return `features/${base[1]}`;
    }
    return base[0] ?? relativePath;
}

/** Options for {@link collectPlaceholders}. */
export interface CollectPlaceholdersOptions {
    /** Directory tree to scan. Defaults to `<repoRoot>/src`. */
    readonly srcDir?: string;
    /** Root the reported `filePaths` are made relative to. Defaults to `srcDir`'s parent. */
    readonly repoRoot?: string;
}

/**
 * Scan the source tree and emit one {@link GapEntry} per placeholder occurrence.
 *
 * Pure with respect to the filesystem snapshot it reads: given the same tree it
 * returns the same entries (including ids), so the Gap_Report is reproducible.
 *
 * @param options - scan root and reporting root overrides (see {@link CollectPlaceholdersOptions}).
 * @returns the placeholder gap entries, sorted by file path then line.
 */
export function collectPlaceholders(options: CollectPlaceholdersOptions = {}): GapEntry[] {
    const srcDir = options.srcDir ?? join(process.cwd(), "src");
    const repoRoot = options.repoRoot ?? join(srcDir, "..");

    const files = collectSourceFiles(srcDir).sort();
    const entries: GapEntry[] = [];

    for (const file of files) {
        if (!statSync(file).isFile()) continue;
        let contents: string;
        try {
            contents = readFileSync(file, "utf8");
        } catch {
            continue;
        }

        const findings = findPlaceholdersInSource(contents);
        if (findings.length === 0) continue;

        // Normalise to a forward-slash repo-relative path for stable, portable ids.
        const relPath = relative(repoRoot, file).split(sep).join("/");
        const feature = featureOf(relPath);

        for (const finding of findings) {
            const detail = `${KIND_LABEL[finding.kind]} at line ${finding.line}: ${finding.snippet}`;
            const { severity, owningPhase } = assignSeverityAndPhase({
                category: "placeholder",
                detail,
                feature,
            });
            entries.push({
                id: gapEntryId({ category: "placeholder", filePath: relPath, detail }),
                feature,
                readmeRef: null,
                filePaths: [relPath],
                category: "placeholder",
                severity,
                // placeholder always resolves to phase 6 (within the schema's 2–8 range).
                owningPhase: owningPhase as GapEntry["owningPhase"],
                detail,
                missingState: null,
                missingObservability: null,
                reason: null,
                status: "open",
            });
        }
    }

    return entries;
}
