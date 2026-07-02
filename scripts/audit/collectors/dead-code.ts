/**
 * Dead-code collector (Phase 1, R1.7).
 *
 * Builds an import graph over the `src/` tree rooted at the application's
 * entry points and flags every module that is **unreachable** from any of
 * those roots — i.e. code that is not reachable from an application entry
 * point and is not (transitively) imported by any module. Each unreferenced
 * module is emitted as a Gap_Report entry with category `dead-code` and its
 * file path (R1.7).
 *
 * ## Roots (application entry points)
 *
 * Next.js App Router loads a fixed set of "special" files by convention rather
 * than by an explicit `import` — these are the graph roots:
 *
 *   - Under `src/app`: `page`, `layout`, `loading`, `error`, `global-error`,
 *     `not-found`, `template`, `default`, `route`, plus the metadata file
 *     conventions (`icon`, `apple-icon`, `opengraph-image`, `twitter-image`,
 *     `sitemap`, `robots`, `manifest`).
 *   - Anywhere under `src`: `middleware`, `instrumentation`,
 *     `instrumentation-client` (framework-invoked, never imported).
 *
 * Every other source file under `src` is "reachable" only if it is imported,
 * directly or transitively, from one of those roots. Anything left over is
 * dead code.
 *
 * ## Edges
 *
 * Edges are derived from static `import … from "…"`, side-effect
 * `import "…"`, `export … from "…"`, dynamic `import("…")`, and
 * `require("…")` specifiers. Relative (`./`, `../`) and alias (`@/…`)
 * specifiers are resolved to a concrete file under `src`; bare specifiers
 * (npm packages, `next/*`, `react`, …) are external and ignored. Comments are
 * stripped first so commented-out imports do not keep a module alive.
 *
 * Test/spec files and ambient declaration files (`*.d.ts`) are excluded from
 * the candidate set: tests are not application modules, and `.d.ts` files are
 * ambient. The collector is a read-only analyser and never mutates source.
 *
 * @see .kiro/specs/production-readiness-hardening/design.md — "Readiness_Audit collectors"
 * _Requirements: 1.7_
 */
import { readdirSync, readFileSync, statSync, type Dirent } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GapEntry, gapEntryId } from "../schema";
import { assignSeverityAndPhase } from "../severity";

/** Repo root resolved relative to this module (`<root>/scripts/audit/collectors`). */
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Options for {@link collectDeadCode}, primarily to support fixture trees in tests. */
export interface DeadCodeCollectorOptions {
    /** Directory tree to scan. Defaults to `<repoRoot>/src`. */
    readonly srcDir?: string;
    /** Root used to compute reported (relative, posix) file paths. Defaults to the repo root. */
    readonly repoRoot?: string;
}

/** Directories never walked. */
const SKIP_DIRECTORIES = new Set([
    "node_modules",
    ".next",
    ".git",
    "dist",
    "build",
    "coverage",
]);

/** Source extensions considered (declaration files are handled separately). */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"] as const;

/** Extensions tried, in order, when resolving an extension-less specifier. */
const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"] as const;

/**
 * App Router special-file basenames (without extension). A file under the app
 * directory with one of these basenames is an entry point the framework loads
 * directly, so it roots the import graph.
 */
const APP_ROUTER_ROOT_BASENAMES = new Set([
    "page",
    "layout",
    "loading",
    "error",
    "global-error",
    "not-found",
    "template",
    "default",
    "route",
    // Metadata file conventions.
    "icon",
    "apple-icon",
    "opengraph-image",
    "twitter-image",
    "sitemap",
    "robots",
    "manifest",
]);

/**
 * Framework-invoked special files that may live anywhere under `src` (most
 * commonly at the `src` root) and are never imported by other modules.
 */
const SRC_ROOT_BASENAMES = new Set(["middleware", "instrumentation", "instrumentation-client"]);

/** True for test/spec files, which are not application modules. */
function isTestFile(fileName: string): boolean {
    return /\.(test|spec)\.[tj]sx?$/.test(fileName) || /\.property\.test\.[tj]sx?$/.test(fileName);
}

/** True for ambient declaration files, which are not flaggable modules. */
function isDeclarationFile(fileName: string): boolean {
    return /\.d\.[mc]?ts$/.test(fileName);
}

/** True for a source file the collector treats as a graph node / candidate. */
function isSourceFile(fileName: string): boolean {
    if (isTestFile(fileName) || isDeclarationFile(fileName)) return false;
    return SOURCE_EXTENSIONS.some((ext) => fileName.endsWith(ext));
}

/** True when the entry at `abs` exists and is a directory. */
function isDirectory(abs: string): boolean {
    try {
        return statSync(abs).isDirectory();
    } catch {
        return false;
    }
}

/** Recursively collect every candidate source file (absolute path) under `dir`. */
function findSourceFiles(dir: string): string[] {
    const out: string[] = [];

    const walk = (current: string): void => {
        let dirents: Dirent[];
        try {
            dirents = readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const dirent of dirents) {
            const abs = path.join(current, dirent.name);
            if (dirent.isDirectory()) {
                if (!SKIP_DIRECTORIES.has(dirent.name)) walk(abs);
                continue;
            }
            if (!dirent.isFile()) continue;
            if (isSourceFile(dirent.name)) out.push(abs);
        }
    };

    if (isDirectory(dir)) walk(dir);
    return out;
}

/**
 * Strip block and line comments so commented-out import statements are not
 * mistaken for live references. The line-comment pass skips `://` (URLs) and
 * `///` (triple-slash directives) to avoid corrupting string literals.
 */
export function stripComments(source: string): string {
    const withoutBlock = source.replace(/\/\*[\s\S]*?\*\//g, " ");
    return withoutBlock.replace(/(?<![:/])\/\/.*$/gm, "");
}

/**
 * Extract every module specifier referenced by `source` via static imports,
 * re-exports, side-effect imports, dynamic `import()`, or `require()`.
 * Comments are stripped first. Returns a de-duplicated list.
 */
export function extractImportSpecifiers(source: string): string[] {
    const code = stripComments(source);
    const specifiers = new Set<string>();

    const patterns: readonly RegExp[] = [
        // import … from "x"  /  export … from "x"  (named, default, namespace, type-only)
        /(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g,
        // side-effect import "x"
        /\bimport\s+['"]([^'"]+)['"]/g,
        // dynamic import("x")
        /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        // require("x")
        /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    for (const pattern of patterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(code)) !== null) {
            const specifier = match[1];
            if (specifier) specifiers.add(specifier);
        }
    }

    return [...specifiers];
}

/**
 * Resolve a candidate module path (with no/ambiguous extension) to a concrete
 * file present in `fileSet`. Tries the path verbatim, then with each source
 * extension, then as a directory `index` file. Returns the resolved absolute
 * path, or `null` when nothing matches a known source file.
 */
function resolveToFile(candidateAbs: string, fileSet: ReadonlySet<string>): string | null {
    if (fileSet.has(candidateAbs)) return candidateAbs;

    for (const ext of RESOLVE_EXTENSIONS) {
        const withExt = candidateAbs + ext;
        if (fileSet.has(withExt)) return withExt;
    }
    for (const ext of RESOLVE_EXTENSIONS) {
        const indexFile = path.join(candidateAbs, `index${ext}`);
        if (fileSet.has(indexFile)) return indexFile;
    }
    return null;
}

/**
 * Resolve an import specifier found in `importerAbs` to an absolute file under
 * `srcDir`, or `null` for bare/external specifiers and unresolvable paths.
 *
 * - `@/…`  → resolved against `srcDir` (the `@/* → ./src/*` path alias).
 * - `./`, `../` → resolved against the importer's directory.
 * - anything else (npm package, `next/*`, `react`, …) → external → `null`.
 */
export function resolveSpecifier(
    specifier: string,
    importerAbs: string,
    srcDir: string,
    fileSet: ReadonlySet<string>,
): string | null {
    let candidateAbs: string;
    if (specifier.startsWith("@/")) {
        candidateAbs = path.join(srcDir, specifier.slice(2));
    } else if (specifier.startsWith("./") || specifier.startsWith("../") || specifier === "." || specifier === "..") {
        candidateAbs = path.resolve(path.dirname(importerAbs), specifier);
    } else {
        return null;
    }
    return resolveToFile(candidateAbs, fileSet);
}

/** True when `absPath` (under the app directory) is an App Router entry point. */
function isAppRouterRoot(absPath: string, appDir: string): boolean {
    const rel = path.relative(appDir, absPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
    const base = path.basename(absPath).replace(/\.[tj]sx?$/, "");
    return APP_ROUTER_ROOT_BASENAMES.has(base);
}

/** True when `absPath` is a framework-invoked special file (`middleware`, …). */
function isSrcRoot(absPath: string): boolean {
    const base = path.basename(absPath).replace(/\.[tj]sx?$/, "");
    return SRC_ROOT_BASENAMES.has(base);
}

/** Normalise an absolute path to a repo-relative posix path for the Gap_Report. */
function toReportPath(abs: string, repoRoot: string): string {
    return path.relative(repoRoot, abs).split(path.sep).join("/");
}

/** Derive a readable feature/area label from a repo-relative file path. */
function deriveFeature(relPath: string): string {
    const segments = relPath.split("/");
    const featuresIdx = segments.indexOf("features");
    if (featuresIdx !== -1 && segments[featuresIdx + 1]) {
        return segments[featuresIdx + 1] as string;
    }
    return path.basename(path.dirname(relPath)) || relPath;
}

/**
 * Build the import graph rooted at the application's entry points and return
 * one `dead-code` Gap_Report entry for every source file under `srcDir` that is
 * not reachable from any root (R1.7).
 *
 * Pure with respect to the filesystem snapshot: it reads but never mutates the
 * source tree, and produces a deterministic, path-sorted result.
 *
 * @param options - optional overrides for the scanned `srcDir` and `repoRoot`.
 * @returns validated `GapEntry[]`, each with category `dead-code` and a single
 *          offending file path.
 */
export function collectDeadCode(options: DeadCodeCollectorOptions = {}): GapEntry[] {
    const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
    const srcDir = options.srcDir ?? path.join(repoRoot, "src");
    const appDir = path.join(srcDir, "app");

    const files = findSourceFiles(srcDir);
    const fileSet = new Set(files);

    // Build adjacency: importer → resolved local dependency files.
    const adjacency = new Map<string, string[]>();
    for (const abs of files) {
        let source: string;
        try {
            source = readFileSync(abs, "utf8");
        } catch {
            adjacency.set(abs, []);
            continue;
        }
        const deps: string[] = [];
        for (const specifier of extractImportSpecifiers(source)) {
            const resolved = resolveSpecifier(specifier, abs, srcDir, fileSet);
            if (resolved !== null) deps.push(resolved);
        }
        adjacency.set(abs, deps);
    }

    // Seed the traversal with the application entry points.
    const roots = files.filter((abs) => isAppRouterRoot(abs, appDir) || isSrcRoot(abs));

    // Transitive reachability from roots (BFS).
    const reachable = new Set<string>();
    const queue: string[] = [...roots];
    for (const root of roots) reachable.add(root);
    while (queue.length > 0) {
        const current = queue.shift() as string;
        for (const dep of adjacency.get(current) ?? []) {
            if (!reachable.has(dep)) {
                reachable.add(dep);
                queue.push(dep);
            }
        }
    }

    // Anything not reachable from a root is dead code.
    const deadFiles = files.filter((abs) => !reachable.has(abs)).sort((a, b) => a.localeCompare(b));

    const entries: GapEntry[] = [];
    for (const abs of deadFiles) {
        const relPath = toReportPath(abs, repoRoot);
        const detail =
            "Module is unreferenced: not reachable from any application entry point " +
            "(page/layout/route/middleware/…) and not imported by any module.";
        const { severity, owningPhase } = assignSeverityAndPhase({
            category: "dead-code",
            detail,
            feature: relPath,
        });
        entries.push(
            GapEntry.parse({
                id: gapEntryId({ category: "dead-code", filePath: relPath, detail }),
                feature: deriveFeature(relPath),
                readmeRef: null,
                filePaths: [relPath],
                category: "dead-code",
                severity,
                owningPhase,
                detail,
                missingState: null,
                missingObservability: null,
                reason: null,
            }),
        );
    }

    return entries;
}
