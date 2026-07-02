/**
 * Unit tests for the dead-code collector (R1.7).
 *
 * Covers the pure helpers (`stripComments`, `extractImportSpecifiers`,
 * `resolveSpecifier`) and the collector's import-graph reachability against a
 * fixture tree, including the invariant that every emitted entry is a
 * well-formed `dead-code` Gap_Report entry naming a single offending file.
 *
 * _Requirements: 1.7_
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { collectDeadCode, extractImportSpecifiers, resolveSpecifier, stripComments } from "./dead-code";

describe("stripComments", () => {
    it("removes block and line comments", () => {
        const out = stripComments('a; /* import "x" */ b; // import "y"\nc;');
        expect(out).not.toContain('"x"');
        expect(out).not.toContain('"y"');
        expect(out).toContain("a;");
        expect(out).toContain("c;");
    });

    it("preserves URLs containing //", () => {
        expect(stripComments('const u = "https://meet.jit.si";')).toContain("https://meet.jit.si");
    });
});

describe("extractImportSpecifiers", () => {
    it("captures static, side-effect, re-export, dynamic, and require specifiers", () => {
        const source = [
            'import a from "./a";',
            'import { b } from "@/lib/b";',
            'import type { T } from "../types";',
            'import "./side-effect";',
            'export { c } from "./c";',
            'export * from "./d";',
            'const e = await import("./e");',
            'const f = require("./f");',
            'import react from "react";',
        ].join("\n");
        const specs = extractImportSpecifiers(source).sort();
        expect(specs).toEqual(
            ["./a", "@/lib/b", "../types", "./side-effect", "./c", "./d", "./e", "./f", "react"].sort(),
        );
    });

    it("ignores commented-out imports", () => {
        const source = '// import "./dead"\n/* import "./also-dead" */\nimport real from "./real";';
        expect(extractImportSpecifiers(source)).toEqual(["./real"]);
    });
});

describe("resolveSpecifier", () => {
    // Use a drive-rooted absolute path so Windows `path.resolve` (which prepends
    // the current drive to drive-less paths) stays consistent with `fileSet`.
    const srcDir = path.resolve(path.sep, "repo", "src");
    const importer = path.join(srcDir, "features", "x", "index.ts");
    const fileSet = new Set([
        path.join(srcDir, "features", "x", "helper.ts"),
        path.join(srcDir, "lib", "b.tsx"),
        path.join(srcDir, "features", "y", "index.ts"),
    ]);

    it("resolves a relative specifier with an inferred extension", () => {
        expect(resolveSpecifier("./helper", importer, srcDir, fileSet)).toBe(
            path.join(srcDir, "features", "x", "helper.ts"),
        );
    });

    it("resolves an @/ alias against srcDir", () => {
        expect(resolveSpecifier("@/lib/b", importer, srcDir, fileSet)).toBe(path.join(srcDir, "lib", "b.tsx"));
    });

    it("resolves a directory import to its index file", () => {
        expect(resolveSpecifier("../y", importer, srcDir, fileSet)).toBe(
            path.join(srcDir, "features", "y", "index.ts"),
        );
    });

    it("returns null for a bare/external specifier", () => {
        expect(resolveSpecifier("react", importer, srcDir, fileSet)).toBeNull();
        expect(resolveSpecifier("next/link", importer, srcDir, fileSet)).toBeNull();
    });

    it("returns null when nothing matches a known source file", () => {
        expect(resolveSpecifier("./missing", importer, srcDir, fileSet)).toBeNull();
    });
});

describe("collectDeadCode", () => {
    let repoRoot: string;
    let srcDir: string;

    beforeAll(() => {
        repoRoot = mkdtempSync(path.join(tmpdir(), "dead-code-collector-"));
        srcDir = path.join(repoRoot, "src");
        const appHome = path.join(srcDir, "app");
        const features = path.join(srcDir, "features", "home");
        const lib = path.join(srcDir, "lib");
        mkdirSync(appHome, { recursive: true });
        mkdirSync(features, { recursive: true });
        mkdirSync(lib, { recursive: true });

        // Root: an App Router page that pulls in a feature component.
        writeFileSync(
            path.join(appHome, "page.tsx"),
            'import { HomeView } from "@/features/home/view";\nexport default function Page() { return <HomeView />; }\n',
            "utf8",
        );
        // Reachable via the page (alias import), then a relative import to a helper.
        writeFileSync(
            path.join(features, "view.tsx"),
            'import { format } from "./helper";\nexport function HomeView() { return format("x"); }\n',
            "utf8",
        );
        writeFileSync(
            path.join(features, "helper.ts"),
            'export function format(s: string) { return s.trim(); }\n',
            "utf8",
        );
        // Framework-invoked root, never imported.
        writeFileSync(
            path.join(srcDir, "middleware.ts"),
            'export function middleware() { return null; }\n',
            "utf8",
        );

        // Dead: not reachable from any root, imported by nobody.
        writeFileSync(path.join(lib, "orphan.ts"), 'export const orphan = 1;\n', "utf8");
        // Dead chain: dead-a imports dead-b, but neither is reachable from a root.
        writeFileSync(path.join(lib, "dead-a.ts"), 'import "./dead-b";\nexport const a = 1;\n', "utf8");
        writeFileSync(path.join(lib, "dead-b.ts"), 'export const b = 2;\n', "utf8");

        // Excluded from candidates: a test file and a declaration file.
        writeFileSync(path.join(lib, "orphan.test.ts"), 'import { orphan } from "./orphan";\n', "utf8");
        writeFileSync(path.join(lib, "ambient.d.ts"), "declare const x: number;\n", "utf8");
    });

    afterAll(() => {
        rmSync(repoRoot, { recursive: true, force: true });
    });

    it("flags only the unreferenced modules", () => {
        const entries = collectDeadCode({ srcDir, repoRoot });
        const dead = entries.map((e) => e.filePaths[0]).sort();
        expect(dead).toEqual(["src/lib/dead-a.ts", "src/lib/dead-b.ts", "src/lib/orphan.ts"]);
    });

    it("does not flag reachable modules or framework roots", () => {
        const flagged = new Set(collectDeadCode({ srcDir, repoRoot }).map((e) => e.filePaths[0]));
        expect(flagged.has("src/app/page.tsx")).toBe(false);
        expect(flagged.has("src/features/home/view.tsx")).toBe(false);
        expect(flagged.has("src/features/home/helper.ts")).toBe(false);
        expect(flagged.has("src/middleware.ts")).toBe(false);
    });

    it("excludes test and declaration files from candidates", () => {
        const flagged = new Set(collectDeadCode({ srcDir, repoRoot }).map((e) => e.filePaths[0]));
        expect(flagged.has("src/lib/orphan.test.ts")).toBe(false);
        expect(flagged.has("src/lib/ambient.d.ts")).toBe(false);
    });

    it("emits well-formed dead-code entries (R1.7, R1.8)", () => {
        const entries = collectDeadCode({ srcDir, repoRoot });
        expect(entries.length).toBeGreaterThan(0);
        for (const entry of entries) {
            expect(entry.category).toBe("dead-code");
            expect(entry.severity).toBe("minor");
            expect(entry.owningPhase).toBe(2);
            expect(entry.filePaths).toHaveLength(1);
            expect(entry.missingState).toBeNull();
            expect(entry.missingObservability).toBeNull();
            expect(entry.id).toMatch(/^[0-9a-f]{64}$/);
        }
    });
});
