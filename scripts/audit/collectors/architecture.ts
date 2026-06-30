/**
 * Architecture collector (Phase 2, R2.1–R2.6).
 *
 * Deterministic static checks over the `src/**` tree and `tsconfig.json` that
 * emit Gap_Report entries with category `architecture`. The five checks mirror
 * the design's "Conformance-check architecture (Phase 2)" section:
 *
 *   - **Feature-first (R2.1)** — domain logic (DB access, business rules, state
 *     machines) must live under `src/features/<domain>/`. Domain logic found
 *     elsewhere is flagged, excluding the allowed shared `src/lib/` utilities
 *     and `src/components/ui` primitives.
 *   - **RSC vs client (R2.2)** — a component declaring `"use client"` with no
 *     client-only behaviour (no `useState`/`useEffect`/`useRef`/event handlers/
 *     browser APIs) is flagged: it should be a Server Component.
 *   - **Duplication (R2.3, R2.4)** — validation schemas and shared types must be
 *     defined exactly once; identical business logic appearing in ≥2 UI
 *     components is flagged. Every duplicate location is named.
 *   - **`any` discipline (R2.5)** — each `any` occurrence must be immediately
 *     preceded by an inline justification comment; otherwise flagged.
 *   - **Strict TS (R2.6)** — `strict` plus each constituent flag and the
 *     recommended `noUncheckedIndexedAccess` must be enabled; each disabled flag
 *     is flagged by name.
 *
 * The collector is a read-only analyser: it never mutates application source.
 * Severity and owning phase come from the shared deterministic assignment
 * (`severity.ts`) — `architecture` maps to `major` / phase 2.
 *
 * @see .kiro/specs/production-readiness-hardening/design.md — "Conformance-check architecture (Phase 2)"
 * _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
 */
import { readFileSync, readdirSync, type Dirent } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GapEntry, gapEntryId } from "../schema";
import { assignSeverityAndPhase } from "../severity";

/** Repo root resolved relative to this module (`<root>/scripts/audit/collectors`). */
const DEFAULT_ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** The constituent strict flags plus the recommended `noUncheckedIndexedAccess` (R2.6). */
export const REQUIRED_STRICT_FLAGS: readonly string[] = [
    "noImplicitAny",
    "strictNullChecks",
    "strictFunctionTypes",
    "strictBindCallApply",
    "strictPropertyInitialization",
    "noImplicitThis",
    "useUnknownInCatchVariables",
    "alwaysStrict",
    "noUncheckedIndexedAccess",
];

/** Options for {@link collectArchitecture}. Roots are overridable for tests. */
export interface ArchitectureCollectorOptions {
    /** Repository root to scan from. Defaults to the resolved repo root. */
    readonly rootDir?: string;
    /** Path to the `tsconfig.json` to inspect. Defaults to `<rootDir>/tsconfig.json`. */
    readonly tsconfigPath?: string;
}

const SKIP_DIRECTORIES = new Set([
    "node_modules",
    ".next",
    ".git",
    "dist",
    "build",
    "coverage",
    "__tests__",
]);

/** True for test/spec files, which are exempt from architecture rules. */
function isTestFile(fileName: string): boolean {
    return /\.(test|spec)\.tsx?$/.test(fileName);
}

/** A discovered source file with its absolute path, repo-relative path, and source. */
interface SourceFile {
    readonly absPath: string;
    readonly relPath: string;
    readonly source: string;
}

/** Recursively collect `.ts`/`.tsx` source files under `src` (excluding tests/d.ts). */
function findSourceFiles(rootDir: string): SourceFile[] {
    const srcDir = path.join(rootDir, "src");
    const files: SourceFile[] = [];

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
            if (!/\.tsx?$/.test(dirent.name)) continue;
            if (isTestFile(dirent.name)) continue;
            if (/\.d\.ts$/.test(dirent.name)) continue;

            const relPath = path.relative(rootDir, abs).split(path.sep).join("/");
            let source: string;
            try {
                source = readFileSync(abs, "utf8");
            } catch {
                continue;
            }
            files.push({ absPath: abs, relPath, source });
        }
    };

    walk(srcDir);
    return files.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

/**
 * Strip comments from TypeScript source so commented-out code is not mistaken
 * for live code. Block comments first, then line comments — skipping `://`
 * (URLs) and `///` (triple-slash directives).
 */
export function stripComments(source: string): string {
    const withoutBlock = source.replace(/\/\*[\s\S]*?\*\//g, " ");
    return withoutBlock.replace(/(?<![:/])\/\/.*$/gm, "");
}

/** Derive a human-readable feature/area name from a repo-relative path. */
function deriveFeature(relPath: string): string {
    const segments = relPath.split("/");
    const featuresIdx = segments.indexOf("features");
    if (featuresIdx !== -1 && segments[featuresIdx + 1]) {
        return segments[featuresIdx + 1] as string;
    }
    return path.basename(path.dirname(relPath));
}

/** Build a validated `architecture` Gap_Report entry. */
function buildEntry(relPath: string, detail: string): GapEntry {
    const feature = deriveFeature(relPath);
    const { severity, owningPhase } = assignSeverityAndPhase({ category: "architecture", detail, feature });
    return GapEntry.parse({
        id: gapEntryId({ category: "architecture", filePath: relPath, detail }),
        feature,
        readmeRef: null,
        filePaths: [relPath],
        category: "architecture",
        severity,
        owningPhase,
        detail,
        missingState: null,
        missingObservability: null,
        reason: null,
    });
}

// ---------------------------------------------------------------------------
// R2.1 — Feature-first placement
// ---------------------------------------------------------------------------

/**
 * Signals that a module contains domain logic: database access, business rules,
 * or state-machine transitions. These are the things the design says must live
 * under `src/features/<domain>/`.
 */
const DOMAIN_LOGIC_PATTERN =
    /\b(?:supabase|createClient|createServerClient|createBrowserClient)\b|\.from\s*\(\s*["'][a-z_]+["']\s*\)|\bdrizzle\b|\bprisma\b|\.(?:insert|update|delete|upsert|rpc)\s*\(|\b(?:status|state)\s*===\s*["'](?:submitted|reviewing|approved|rejected|pending|published|draft)["']/;

/**
 * A file is allowed to contain domain logic when it lives under
 * `src/features/<domain>/`. Files under `src/lib/` (shared utilities) and
 * `src/components/ui/` (UI primitives) are explicitly exempt from the check,
 * as are App-Router server entry points (`route.ts`, `actions.ts` co-located
 * with a feature already live under features) — but per the design only the
 * `src/lib` and `src/components/ui` carve-outs are excluded; everything else
 * outside `src/features/<domain>` is flagged.
 */
function isFeatureFirstExempt(relPath: string): boolean {
    return (
        relPath.startsWith("src/features/") ||
        relPath.startsWith("src/lib/") ||
        relPath.startsWith("src/components/ui/")
    );
}

/**
 * Strip import/require/re-export lines so domain logic detection does not flag
 * bare import paths (e.g. `@/lib/supabase/middleware`) as domain logic.
 */
function stripImportLines(code: string): string {
    return code
        .split(/\r?\n/)
        .filter((line) => {
            const trimmed = line.trim();
            // Static import/export-from/require
            if (/^import\b/.test(trimmed)) return false;
            if (/^export\s*\{[^}]*\}\s*from\b/.test(trimmed)) return false;
            if (/\brequire\s*\(/.test(trimmed) && !/\.from\s*\(/.test(trimmed)) return false;
            return true;
        })
        .join("\n");
}

/** Check R2.1: domain logic outside the allowed locations. */
export function checkFeatureFirst(files: readonly SourceFile[]): GapEntry[] {
    const entries: GapEntry[] = [];
    for (const file of files) {
        if (isFeatureFirstExempt(file.relPath)) continue;
        const code = stripImportLines(stripComments(file.source));
        if (DOMAIN_LOGIC_PATTERN.test(code)) {
            entries.push(
                buildEntry(
                    file.relPath,
                    "Domain logic (database access, business rules, or state-machine transitions) lives outside src/features/<domain>/ (R2.1).",
                ),
            );
        }
    }
    return entries;
}

// ---------------------------------------------------------------------------
// R2.2 — RSC vs client misuse
// ---------------------------------------------------------------------------

/** True when the source declares a top-of-file `"use client"` directive. */
export function hasUseClientDirective(source: string): boolean {
    const directive = /^\s*['"]use client['"]\s*;?\s*$/;
    let inspected = 0;
    for (const rawLine of source.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line === "") continue;
        if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;
        if (directive.test(line)) return true;
        inspected += 1;
        if (inspected >= 3) return false;
    }
    return false;
}

/** Client-only behaviour signals (React state/effects/refs, events, browser APIs). */
const CLIENT_ONLY_PATTERN =
    /\buse(?:State|Effect|LayoutEffect|Ref|Reducer|Context|Callback|Memo|Router|SearchParams|Pathname|FormStatus|ActionState|Transition|Optimistic)\b|\bon[A-Z][A-Za-z]+\s*=|\baddEventListener\b|\b(?:window|document|localStorage|sessionStorage|navigator|location)\b|\buse[A-Z][A-Za-z]*\s*\(/;

/**
 * Whether a `"use client"` component performs any client-only behaviour. A
 * component with no such signal should be a Server Component (R2.2).
 */
export function hasClientOnlyBehaviour(source: string): boolean {
    const code = stripComments(source);
    return CLIENT_ONLY_PATTERN.test(code);
}

/** Check R2.2: `"use client"` components with no client-only behaviour. */
export function checkRscVsClient(files: readonly SourceFile[]): GapEntry[] {
    const entries: GapEntry[] = [];
    for (const file of files) {
        if (!file.relPath.endsWith(".tsx")) continue;
        if (!hasUseClientDirective(file.source)) continue;
        if (hasClientOnlyBehaviour(file.source)) continue;
        entries.push(
            buildEntry(
                file.relPath,
                'Component declares "use client" but performs no client-only behaviour (no state, effects, refs, event handlers, or browser APIs); it should be a Server Component (R2.2).',
            ),
        );
    }
    return entries;
}

// ---------------------------------------------------------------------------
// R2.3 / R2.4 — Duplicated schemas, shared types, and business logic
// ---------------------------------------------------------------------------

/** A named definition and the file it was found in. */
interface NamedDefinition {
    readonly name: string;
    readonly relPath: string;
    /** Kind label used in the violation detail. */
    readonly kind: "schema" | "type";
}

/** Extract Zod schema definitions (`const FooSchema = z.object(...)` etc.). */
function extractSchemaDefinitions(file: SourceFile): NamedDefinition[] {
    const code = stripComments(file.source);
    const defs: NamedDefinition[] = [];
    const re = /\b(?:export\s+)?const\s+([A-Za-z0-9_]*Schema)\s*=\s*z\./g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(code)) !== null) {
        const name = match[1];
        if (name) defs.push({ name, relPath: file.relPath, kind: "schema" });
    }
    return defs;
}

/** Extract exported shared type/interface definitions. */
function extractTypeDefinitions(file: SourceFile): NamedDefinition[] {
    const code = stripComments(file.source);
    const defs: NamedDefinition[] = [];
    const re = /\bexport\s+(?:type|interface)\s+([A-Za-z0-9_]+)\b/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(code)) !== null) {
        const name = match[1];
        if (name) defs.push({ name, relPath: file.relPath, kind: "type" });
    }
    return defs;
}

/**
 * Check R2.3/R2.4: each schema and each shared type defined in ≥2 files is a
 * duplication violation. One entry is emitted per duplicate location (the file
 * paths of every definition after the first occurrence are named).
 */
export function checkDuplication(files: readonly SourceFile[]): GapEntry[] {
    const entries: GapEntry[] = [];

    // Group definitions by (kind, name); a name in ≥2 distinct files is duplicated.
    const byKey = new Map<string, NamedDefinition[]>();
    for (const file of files) {
        for (const def of [...extractSchemaDefinitions(file), ...extractTypeDefinitions(file)]) {
            const key = `${def.kind}:${def.name}`;
            const list = byKey.get(key) ?? [];
            list.push(def);
            byKey.set(key, list);
        }
    }

    for (const [, defs] of [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const distinctFiles = [...new Set(defs.map((d) => d.relPath))].sort();
        if (distinctFiles.length < 2) continue;
        const first = defs[0];
        if (!first) continue;
        const allLocations = distinctFiles.join(", ");
        // One violation per duplicate location (every file beyond the first).
        for (const relPath of distinctFiles.slice(1)) {
            entries.push(
                buildEntry(
                    relPath,
                    `${first.kind === "schema" ? "Validation schema" : "Shared type"} "${first.name}" is defined in ${distinctFiles.length} locations (${allLocations}); it must be defined exactly once and imported where needed (R2.4).`,
                ),
            );
        }
    }

    // Identical business-logic blocks duplicated across ≥2 UI components (R2.3).
    entries.push(...checkDuplicatedLogic(files));

    return entries;
}

/** A normalised logic fingerprint and where it was seen. */
interface LogicOccurrence {
    readonly relPath: string;
    readonly snippet: string;
}

/** Whether a file is a UI component (lives under components/features and is .tsx). */
function isUiComponent(relPath: string): boolean {
    return relPath.endsWith(".tsx");
}

/**
 * Detect identical/semantically-equivalent business-logic blocks duplicated
 * across ≥2 UI components (R2.3). We fingerprint non-trivial function bodies
 * (whitespace-normalised) and flag any fingerprint appearing in ≥2 files.
 */
export function checkDuplicatedLogic(files: readonly SourceFile[]): GapEntry[] {
    const byFingerprint = new Map<string, LogicOccurrence[]>();

    for (const file of files) {
        if (!isUiComponent(file.relPath)) continue;
        for (const fingerprint of extractLogicFingerprints(file.source)) {
            const list = byFingerprint.get(fingerprint.normalised) ?? [];
            list.push({ relPath: file.relPath, snippet: fingerprint.snippet });
            byFingerprint.set(fingerprint.normalised, list);
        }
    }

    const entries: GapEntry[] = [];
    for (const [, occurrences] of [...byFingerprint.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const distinctFiles = [...new Set(occurrences.map((o) => o.relPath))].sort();
        if (distinctFiles.length < 2) continue;
        const allLocations = distinctFiles.join(", ");
        const snippet = occurrences[0]?.snippet ?? "";
        for (const relPath of distinctFiles.slice(1)) {
            entries.push(
                buildEntry(
                    relPath,
                    `Business logic ("${snippet}") is duplicated across ${distinctFiles.length} UI components (${allLocations}); extract it into a reusable hook, service, or schema (R2.3).`,
                ),
            );
        }
    }
    return entries;
}

/** A fingerprinted logic block. */
interface LogicFingerprint {
    readonly normalised: string;
    /** Short human-readable snippet for the violation detail. */
    readonly snippet: string;
}

/**
 * Extract candidate business-logic blocks from a component's source and return
 * their whitespace-normalised fingerprints. We consider the bodies of named
 * helper functions and arrow-function consts declared inside the file, which is
 * where extractable business logic typically lives. Trivial bodies (very short)
 * are ignored to avoid false positives on one-line render helpers.
 */
export function extractLogicFingerprints(source: string): LogicFingerprint[] {
    const code = stripComments(source);
    const fingerprints: LogicFingerprint[] = [];

    // Named function declarations and arrow-function consts with a block body.
    const headerRe =
        /(?:function\s+([A-Za-z0-9_]+)\s*\([^)]*\)|const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::[^=]+)?=>)\s*\{/g;
    let match: RegExpExecArray | null;
    while ((match = headerRe.exec(code)) !== null) {
        const name = match[1] ?? match[2] ?? "anonymous";
        const open = headerRe.lastIndex - 1;
        const close = findMatchingBrace(code, open);
        if (close === -1) continue;
        const body = code.slice(open + 1, close);
        const normalised = body.replace(/\s+/g, " ").trim();
        // Ignore trivial bodies — require some real logic to call it duplication.
        if (normalised.length < 40) continue;
        if (!/[;{}]|return\b/.test(normalised)) continue;
        fingerprints.push({ normalised, snippet: name });
    }
    return fingerprints;
}

/** Return the index of the `}` matching the `{` at `openIndex`, or -1. */
function findMatchingBrace(src: string, openIndex: number): number {
    let depth = 1;
    let i = openIndex + 1;
    const n = src.length;
    while (i < n && depth > 0) {
        const c = src[i];
        if (c === "{") depth += 1;
        else if (c === "}") depth -= 1;
        i += 1;
    }
    return depth === 0 ? i - 1 : -1;
}

// ---------------------------------------------------------------------------
// R2.5 — `any` without an inline justification comment
// ---------------------------------------------------------------------------

/** Matches a use of the `any` type as a whole word. */
const ANY_TOKEN = /(?<![A-Za-z0-9_$])any(?![A-Za-z0-9_$])/;

/**
 * Whether a line uses the `any` type in a type position. Excludes occurrences
 * inside string/template literals and identifiers like `anyone`/`Company`.
 */
function lineUsesAnyType(line: string): boolean {
    // Strip string and template literals so `"any"` doesn't count.
    const withoutStrings = line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
    if (!ANY_TOKEN.test(withoutStrings)) return false;
    // Require a type-position context: `: any`, `<any`, `any>`, `any[]`, `as any`,
    // `any |`, `| any`, `Array<any`, `Record<..., any`, `(x: any)`.
    return /(?:[:<,|&(]\s*|as\s+|=>\s*)any\b|\bany\s*(?:\[\]|>|\||&|\)|,)/.test(withoutStrings);
}

/** Whether a line is an inline justification comment for an `any` exception. */
function isJustificationComment(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*");
}

/**
 * Check R2.5: every `any` must be immediately preceded by an inline
 * justification comment. One violation is emitted per offending line.
 */
export function checkAnyDiscipline(files: readonly SourceFile[]): GapEntry[] {
    const entries: GapEntry[] = [];
    for (const file of files) {
        const lines = file.source.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            if (line === undefined) continue;
            if (!lineUsesAnyType(line)) continue;

            // The directly preceding non-empty line must be a comment.
            let prevIdx = i - 1;
            while (prevIdx >= 0 && (lines[prevIdx] ?? "").trim() === "") prevIdx -= 1;
            const prev = prevIdx >= 0 ? (lines[prevIdx] ?? "") : "";
            // Also allow a trailing same-line comment as justification.
            const sameLineComment = /\/\/|\/\*/.test(line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""'));
            if (isJustificationComment(prev) || sameLineComment) continue;

            entries.push(
                buildEntry(
                    file.relPath,
                    `Use of the \`any\` type at line ${i + 1} is not immediately preceded by an inline justification comment (R2.5).`,
                ),
            );
        }
    }
    return entries;
}

// ---------------------------------------------------------------------------
// R2.6 — strict TypeScript flags
// ---------------------------------------------------------------------------

/**
 * Parse a tsconfig's compilerOptions, tolerating JSONC comments and trailing
 * commas. Returns an empty object when the file cannot be read/parsed.
 */
export function parseCompilerOptions(tsconfigSource: string): Record<string, unknown> {
    try {
        const lines = tsconfigSource.split(/\r?\n/).map(line => {
            const commentIdx = line.indexOf('//');
            const strIdx = line.indexOf('"');
            if (commentIdx !== -1 && (strIdx === -1 || commentIdx < strIdx)) {
                return line.slice(0, commentIdx);
            }
            return line;
        });
        const noComments = lines.join('\n').replace(/\/\*[\s\S]*?\*\//g, (match, offset, string) => {
            const before = string.slice(0, offset);
            const quotes = (before.match(/"/g) || []).length;
            if (quotes % 2 !== 0) return match;
            return "";
        });
        const withoutTrailingCommas = noComments.replace(/,(\s*[}\]])/g, "$1");
        const parsed = JSON.parse(withoutTrailingCommas) as { compilerOptions?: Record<string, unknown> };
        return parsed.compilerOptions ?? {};
    } catch {
        return {};
    }
}

/**
 * Check R2.6: `strict` plus every constituent flag and the recommended
 * `noUncheckedIndexedAccess` must be enabled. When `strict` itself is enabled,
 * a constituent flag counts as enabled unless explicitly set to `false`.
 * `noUncheckedIndexedAccess` is not implied by `strict`, so it must be set true.
 */
export function checkStrictFlags(compilerOptions: Record<string, unknown>, tsconfigRelPath: string): GapEntry[] {
    const entries: GapEntry[] = [];
    const strictEnabled = compilerOptions["strict"] === true;

    if (!strictEnabled) {
        entries.push(buildEntry(tsconfigRelPath, "TypeScript strict mode flag `strict` is not enabled (R2.6)."));
    }

    for (const flag of REQUIRED_STRICT_FLAGS) {
        const value = compilerOptions[flag];
        if (flag === "noUncheckedIndexedAccess") {
            // Not implied by `strict`; must be explicitly true.
            if (value !== true) {
                entries.push(buildEntry(tsconfigRelPath, `TypeScript strictness flag \`${flag}\` is not enabled (R2.6).`));
            }
            continue;
        }
        // A constituent flag is disabled if explicitly false, or if `strict`
        // is off and it is not explicitly enabled.
        if (value === false || (!strictEnabled && value !== true)) {
            entries.push(buildEntry(tsconfigRelPath, `TypeScript strictness flag \`${flag}\` is disabled (R2.6).`));
        }
    }

    return entries;
}

// ---------------------------------------------------------------------------
// Collector entry point
// ---------------------------------------------------------------------------

/**
 * Run all architecture conformance checks and return one `architecture`
 * Gap_Report entry per violation (R2.1–R2.6).
 *
 * @param options - optional scan-root and tsconfig overrides (for tests).
 * @returns validated `GapEntry[]`, each with category `architecture`.
 */
export function collectArchitecture(options: ArchitectureCollectorOptions = {}): GapEntry[] {
    const rootDir = options.rootDir ?? DEFAULT_ROOT_DIR;
    const tsconfigPath = options.tsconfigPath ?? path.join(rootDir, "tsconfig.json");

    const files = findSourceFiles(rootDir);

    const entries: GapEntry[] = [
        ...checkFeatureFirst(files),
        ...checkRscVsClient(files),
        ...checkDuplication(files),
        ...checkAnyDiscipline(files),
    ];

    let tsconfigSource: string | null = null;
    try {
        tsconfigSource = readFileSync(tsconfigPath, "utf8");
    } catch {
        tsconfigSource = null;
    }
    if (tsconfigSource !== null) {
        const tsconfigRelPath = path.relative(rootDir, tsconfigPath).split(path.sep).join("/") || "tsconfig.json";
        entries.push(...checkStrictFlags(parseCompilerOptions(tsconfigSource), tsconfigRelPath));
    }

    return entries;
}
