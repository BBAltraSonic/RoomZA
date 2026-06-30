/**
 * Input-validation collector (Phase 1, R1.5).
 *
 * Finds every **API route**, **Server Action**, and **input-accepting form**
 * that lacks Zod validation on at least one input field, and records each as a
 * Gap_Report entry with category `missing-validation` carrying the offending
 * file path and a human-readable `detail`.
 *
 * The collector feeds Phase 8 / Security (R8.2, R8.3, task 14.3), whose exit
 * condition is "validate input against a Zod schema before processing" at every
 * API route and Server Action boundary.
 *
 * ## What counts as an input boundary
 *
 * 1. **API route handlers** — exported HTTP-method functions (`GET`/`POST`/…)
 *    in a `route.ts`/`route.tsx` file. A handler "accepts input" when its body
 *    reads `searchParams`, the request body (`request.json()/.text()/.formData()`),
 *    or route `params`. A handler that only reads an auth header/secret (e.g. a
 *    cron trigger) does not accept user input and is not flagged.
 *
 * 2. **Server Actions** — exported `async` functions in a file carrying the
 *    top-level `"use server"` directive. A Server Action "accepts input" when it
 *    declares at least one parameter (every parameter of a Server Action is
 *    client-supplied).
 *
 * 3. **Forms** — `.tsx` files containing a `<form>` with input controls. Forms
 *    that delegate submission to a validated boundary (a Server Action via
 *    `action={…}`/`useActionState`, an imported actions module, or a
 *    `fetch()` to an API route) are evaluated *at that boundary* instead, so they
 *    are not double-counted here. Navigational `role="search"` forms are not
 *    data-input boundaries and are skipped. Only an "orphan" form — one that
 *    collects input through no detectable validated path — is flagged.
 *
 * A boundary is considered validated when it references Zod validation:
 * `safeParse(...)`, a `…Schema.parse(...)` call, or `zodResolver`.
 *
 * @see .kiro/specs/production-readiness-hardening/design.md — "Readiness_Audit collectors"
 * _Requirements: 1.5_
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { assignSeverityAndPhase } from "../severity";
import { gapEntryId, type GapEntry } from "../schema";

/** Options controlling where the collector scans and how paths are reported. */
export interface InputValidationCollectorOptions {
    /** Directory tree to scan. Defaults to `<repoRoot>/src`. */
    readonly srcDir?: string;
    /** Root used to compute reported (relative, posix) file paths. Defaults to cwd. */
    readonly repoRoot?: string;
}

/** The HTTP methods recognised as Next.js App Router route handlers. */
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

/** Directory/file fragments excluded from the scan. */
const SKIP_DIR = new Set(["node_modules", ".next", ".git", "dist", "build", "__tests__"]);

/**
 * Determine whether a source file references Zod validation of its input.
 *
 * Recognises `safeParse(...)` and `zodResolver` unambiguously, and a
 * schema-style `<name>.parse(...)` call. A bare `.parse(...)` only counts when
 * the file imports from `"zod"`, and never matches `JSON.parse`/`Date.parse`/…
 */
export function hasZodValidation(source: string): boolean {
    if (/\bsafeParse\s*\(/.test(source)) return true;
    if (/\bzodResolver\b/.test(source)) return true;

    // Remove well-known non-Zod `.parse(` calls before looking for a parse call.
    const stripped = source.replace(/\b(?:JSON|Date|Number|Boolean|parseInt|parseFloat)\.parse\s*\(/g, "");
    if (/\b\w*[Ss]chema\.parse\s*\(/.test(stripped)) return true;
    if (/\.parse\s*\(/.test(stripped) && /from\s+["']zod["']/.test(source)) return true;

    return false;
}

/** Advance past a single- or double-quoted string starting at `i` (the quote). */
function skipString(src: string, i: number, quote: string): number {
    let j = i + 1;
    const n = src.length;
    while (j < n) {
        const c = src[j];
        if (c === "\\") {
            j += 2;
            continue;
        }
        if (c === quote) return j + 1;
        if (c === "\n") return j; // unterminated single-line string — bail safely
        j += 1;
    }
    return n;
}

/** Advance past a template literal (handling `${ … }` expressions) starting at the backtick. */
function skipTemplate(src: string, i: number): number {
    let j = i + 1;
    const n = src.length;
    while (j < n) {
        const c = src[j];
        if (c === "\\") {
            j += 2;
            continue;
        }
        if (c === "`") return j + 1;
        if (c === "$" && src[j + 1] === "{") {
            j = skipBalancedBraces(src, j + 1);
            continue;
        }
        j += 1;
    }
    return n;
}

/** Given the index of an opening `{`, return the index just past its matching `}`. */
function skipBalancedBraces(src: string, openIndex: number): number {
    const close = findMatchingBrace(src, openIndex);
    return close === -1 ? src.length : close + 1;
}

/**
 * Return the index of the `}` matching the `{` at `openIndex`, skipping over
 * strings, template literals (and their `${}` expressions), and comments.
 * Returns -1 when no matching brace is found.
 */
export function findMatchingBrace(src: string, openIndex: number): number {
    let depth = 1;
    let i = openIndex + 1;
    const n = src.length;
    while (i < n && depth > 0) {
        const c = src[i];
        const next = src[i + 1];
        if (c === "/" && next === "/") {
            const nl = src.indexOf("\n", i);
            i = nl === -1 ? n : nl;
            continue;
        }
        if (c === "/" && next === "*") {
            const end = src.indexOf("*/", i + 2);
            i = end === -1 ? n : end + 2;
            continue;
        }
        if (c === "'" || c === '"') {
            i = skipString(src, i, c);
            continue;
        }
        if (c === "`") {
            i = skipTemplate(src, i);
            continue;
        }
        if (c === "{") depth += 1;
        else if (c === "}") depth -= 1;
        i += 1;
    }
    return depth === 0 ? i - 1 : -1;
}

/**
 * Starting at `from` (just past a parameter list's `)`), return the index of the
 * function body's opening `{`. Object/generic type braces in a return-type
 * annotation (e.g. `: Promise<ActionResult<{ id: string }>>`) are skipped by
 * tracking angle/paren/bracket depth. Returns -1 for a body-less signature.
 */
function locateBodyBrace(src: string, from: number): number {
    let i = from;
    let angle = 0;
    let paren = 0;
    let bracket = 0;
    const n = src.length;
    while (i < n) {
        const c = src[i];
        const next = src[i + 1];
        if (c === "/" && next === "/") {
            const nl = src.indexOf("\n", i);
            i = nl === -1 ? n : nl;
            continue;
        }
        if (c === "/" && next === "*") {
            const end = src.indexOf("*/", i + 2);
            i = end === -1 ? n : end + 2;
            continue;
        }
        if (c === "'" || c === '"') {
            i = skipString(src, i, c);
            continue;
        }
        if (c === "`") {
            i = skipTemplate(src, i);
            continue;
        }
        if (c === "<") {
            angle += 1;
            i += 1;
            continue;
        }
        if (c === ">") {
            if (src[i - 1] !== "=") angle = Math.max(0, angle - 1); // ignore the `>` in `=>`
            i += 1;
            continue;
        }
        if (c === "(") {
            paren += 1;
            i += 1;
            continue;
        }
        if (c === ")") {
            paren -= 1;
            i += 1;
            continue;
        }
        if (c === "[") {
            bracket += 1;
            i += 1;
            continue;
        }
        if (c === "]") {
            bracket -= 1;
            i += 1;
            continue;
        }
        if (c === "{") {
            if (angle === 0 && paren === 0 && bracket === 0) return i;
            i = skipBalancedBraces(src, i); // a type-position brace — skip it
            continue;
        }
        if (c === ";") return -1; // overload/declaration with no body
        i += 1;
    }
    return -1;
}

/** A single exported function and its extracted body. */
interface ExtractedFunction {
    readonly name: string;
    /** Raw parameter list text (between the outer parens). */
    readonly params: string;
    /** Function body source (between and including the outer braces), or "" if not found. */
    readonly body: string;
}

/**
 * Extract exported `function` declarations (optionally `async`) whose name
 * matches `nameFilter`, returning each function's parameter text and body.
 */
function extractExportedFunctions(source: string, nameFilter: RegExp): ExtractedFunction[] {
    const results: ExtractedFunction[] = [];
    const headerRe = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    while ((match = headerRe.exec(source)) !== null) {
        const name = match[1] ?? "";
        if (!nameFilter.test(name)) continue;
        const params = match[2] ?? "";
        const bodyOpen = locateBodyBrace(source, headerRe.lastIndex);
        if (bodyOpen === -1) continue;
        const bodyClose = findMatchingBrace(source, bodyOpen);
        const body = bodyClose === -1 ? "" : source.slice(bodyOpen, bodyClose + 1);
        results.push({ name, params, body });
    }
    return results;
}

/** True when a parameter list contains at least one parameter. */
function hasParameters(params: string): boolean {
    return params.trim().length > 0;
}

/** Whether a route-handler body reads request input (query, body, or route params). */
export function handlerAcceptsInput(body: string): boolean {
    return /searchParams|nextUrl|\bparams\b|\b(?:request|req)\.(?:json|text|formData|body)\b|await\s+(?:request|req)\b/.test(
        body,
    );
}

/** True when the file declares the top-level `"use server"` directive. */
export function isServerActionFile(source: string): boolean {
    return /^\s*["']use server["']\s*;?\s*$/m.test(source);
}

/**
 * Whether a form file delegates its submission to a validated boundary
 * (a Server Action, an imported actions module, or a `fetch()` to an API
 * route), in which case the boundary — not the form — is the place validation
 * is audited.
 */
export function formDelegatesToBoundary(source: string): boolean {
    if (/action=\{/.test(source)) return true; // <form action={serverAction}>
    if (/\buseActionState\b/.test(source)) return true;
    if (/from\s+["'][^"']*actions[^"']*["']/.test(source)) return true; // imports a server-action module
    if (/\bfetch\s*\(/.test(source)) return true; // posts to an API route (audited there)
    return false;
}

/** True when the file contains a `<form>` with at least one input control. */
function isInputForm(source: string): boolean {
    if (!/<form[\s>]/.test(source)) return false;
    return /<input\b|<textarea\b|<select\b|<Input\b|<Textarea\b|<Select\b/.test(source);
}

/** True for a navigational search form (`role="search"`), which is not a data boundary. */
function isSearchForm(source: string): boolean {
    return /role=["']search["']/.test(source);
}

/** Normalise an absolute path to a repo-relative posix path for stable reporting. */
function toRelativePosix(repoRoot: string, absPath: string): string {
    return path.relative(repoRoot, absPath).split(path.sep).join("/");
}

/** Derive a readable feature/area label from a repo-relative file path. */
function featureLabel(relPath: string): string {
    const featureMatch = relPath.match(/src\/features\/([^/]+)/);
    if (featureMatch) return featureMatch[1] ?? relPath;
    const appMatch = relPath.match(/src\/app\/(.+)/);
    if (appMatch) return `app/${(appMatch[1] ?? "").replace(/\/route\.[tj]sx?$/, "")}`;
    return relPath;
}

/** Build a `missing-validation` Gap_Report entry for an input boundary. */
function buildEntry(relPath: string, detail: string): GapEntry {
    const feature = featureLabel(relPath);
    const { severity, owningPhase } = assignSeverityAndPhase({
        category: "missing-validation",
        detail,
        feature,
    });
    return {
        id: gapEntryId({ category: "missing-validation", filePath: relPath, detail }),
        feature,
        readmeRef: null,
        filePaths: [relPath],
        category: "missing-validation",
        severity,
        // missing-validation always resolves to phase 8 (within the schema's 2–8 range).
        owningPhase: owningPhase as GapEntry["owningPhase"],
        detail,
        missingState: null,
        missingObservability: null,
        reason: null,
        status: "open",
    };
}

/** Analyse a single `route.ts` file, returning one entry per unvalidated handler. */
export function analyzeApiRouteFile(relPath: string, source: string): GapEntry[] {
    const methodFilter = new RegExp(`^(?:${HTTP_METHODS.join("|")})$`);
    const handlers = extractExportedFunctions(source, methodFilter);
    const entries: GapEntry[] = [];
    for (const handler of handlers) {
        if (!handlerAcceptsInput(handler.body)) continue;
        if (hasZodValidation(handler.body)) continue;
        entries.push(
            buildEntry(
                relPath,
                `API route handler ${handler.name}() accepts request input but does not validate it with a Zod schema.`,
            ),
        );
    }
    return entries;
}

/** Analyse a `"use server"` file, returning one entry per unvalidated input-accepting action. */
export function analyzeServerActionFile(relPath: string, source: string): GapEntry[] {
    const actions = extractExportedFunctions(source, /.*/);
    const entries: GapEntry[] = [];
    for (const action of actions) {
        // HTTP-method names never appear in a "use server" file; every exported
        // async function here is a Server Action.
        if (!hasParameters(action.params)) continue; // accepts no input
        if (hasZodValidation(action.body)) continue;
        entries.push(
            buildEntry(
                relPath,
                `Server Action ${action.name}() accepts input (${action.params.trim()}) but does not validate it with a Zod schema.`,
            ),
        );
    }
    return entries;
}

/** Analyse a `.tsx` form file, returning an entry only for an orphan (undelegated) input form. */
export function analyzeFormFile(relPath: string, source: string): GapEntry[] {
    if (!isInputForm(source)) return [];
    if (isSearchForm(source)) return [];
    if (formDelegatesToBoundary(source)) return [];
    if (hasZodValidation(source)) return [];
    return [
        buildEntry(
            relPath,
            "Form accepts input but routes it through no validated boundary (no Zod, Server Action, or API submission detected).",
        ),
    ];
}

/** Recursively collect candidate source file paths under `dir`. */
async function walk(dir: string): Promise<string[]> {
    const out: string[] = [];
    let entries: import("node:fs").Dirent[];
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const entry of entries) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIR.has(entry.name)) continue;
            out.push(...(await walk(abs)));
            continue;
        }
        if (!entry.isFile()) continue;
        if (/\.(test|spec)\.[tj]sx?$/.test(entry.name)) continue;
        if (/\.d\.ts$/.test(entry.name)) continue;
        if (/\.[tj]sx?$/.test(entry.name)) out.push(abs);
    }
    return out;
}

/**
 * Scan the source tree for API routes, Server Actions, and forms that accept
 * input without Zod validation, returning a `missing-validation` Gap_Report
 * entry for each (R1.5).
 */
export async function collectInputValidationGaps(
    options: InputValidationCollectorOptions = {},
): Promise<GapEntry[]> {
    const repoRoot = options.repoRoot ?? process.cwd();
    const srcDir = options.srcDir ?? path.join(repoRoot, "src");

    const files = await walk(srcDir);
    const entries: GapEntry[] = [];

    for (const abs of files) {
        const relPath = toRelativePosix(repoRoot, abs);
        const source = await fs.readFile(abs, "utf8");
        const base = path.basename(abs);

        if (/^route\.[tj]sx?$/.test(base)) {
            entries.push(...analyzeApiRouteFile(relPath, source));
            continue;
        }
        if (isServerActionFile(source)) {
            entries.push(...analyzeServerActionFile(relPath, source));
            continue;
        }
        if (/\.[tj]sx$/.test(base)) {
            entries.push(...analyzeFormFile(relPath, source));
        }
    }

    return entries;
}
