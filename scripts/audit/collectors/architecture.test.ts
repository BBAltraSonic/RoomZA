/**
 * Unit tests for the architecture collector (R2.1–R2.6).
 *
 * Covers the pure checks (feature-first, RSC-vs-client, duplication, `any`
 * discipline, strict flags) and the collector's entry shape against a fixture
 * tree, including the invariant that every emitted entry is an `architecture`
 * gap mapped to major/phase 2.
 *
 * _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
    checkAnyDiscipline,
    checkStrictFlags,
    collectArchitecture,
    hasClientOnlyBehaviour,
    hasUseClientDirective,
    parseCompilerOptions,
    REQUIRED_STRICT_FLAGS,
} from "./architecture";

const sf = (relPath: string, source: string) => ({ absPath: relPath, relPath, source });

describe("hasUseClientDirective", () => {
    it("detects a top-of-file directive", () => {
        expect(hasUseClientDirective('"use client";\nexport default function C() {}')).toBe(true);
    });
    it("ignores files without the directive", () => {
        expect(hasUseClientDirective("export default function C() {}")).toBe(false);
    });
});

describe("hasClientOnlyBehaviour", () => {
    it("detects React state", () => {
        expect(hasClientOnlyBehaviour("const [x, setX] = useState(0);")).toBe(true);
    });
    it("detects an event handler", () => {
        expect(hasClientOnlyBehaviour("<button onClick={fn}>x</button>")).toBe(true);
    });
    it("detects a browser API", () => {
        expect(hasClientOnlyBehaviour("window.scrollTo(0, 0);")).toBe(true);
    });
    it("returns false for purely presentational markup", () => {
        expect(hasClientOnlyBehaviour("return <div className='card'>{props.title}</div>;")).toBe(false);
    });
});

describe("checkAnyDiscipline (R2.5)", () => {
    it("flags an unjustified any", () => {
        const entries = checkAnyDiscipline([sf("src/x.ts", "const v: any = load();")]);
        expect(entries).toHaveLength(1);
        expect(entries[0]?.category).toBe("architecture");
    });
    it("accepts an any preceded by a justification comment", () => {
        const src = "// justified: third-party lib has no types\nconst v: any = load();";
        expect(checkAnyDiscipline([sf("src/x.ts", src)])).toHaveLength(0);
    });
    it("accepts an any justified with a trailing comment", () => {
        const src = "const v: any = load(); // justified: dynamic shape";
        expect(checkAnyDiscipline([sf("src/x.ts", src)])).toHaveLength(0);
    });
    it("does not flag the word any inside a string", () => {
        expect(checkAnyDiscipline([sf("src/x.ts", 'const s = "anyone can read any string";')])).toHaveLength(0);
    });
});

describe("parseCompilerOptions + checkStrictFlags (R2.6)", () => {
    it("emits no violations when strict and all flags are enabled", () => {
        const opts: Record<string, unknown> = { strict: true, noUncheckedIndexedAccess: true };
        for (const flag of REQUIRED_STRICT_FLAGS) opts[flag] = true;
        expect(checkStrictFlags(opts, "tsconfig.json")).toHaveLength(0);
    });

    it("flags strict when disabled", () => {
        const entries = checkStrictFlags({ noUncheckedIndexedAccess: true }, "tsconfig.json");
        // strict missing => strict + every constituent flag (8) flagged; noUnchecked ok.
        expect(entries.some((e) => e.detail.includes("`strict`"))).toBe(true);
    });

    it("flags a single explicitly-disabled constituent flag by name", () => {
        const opts: Record<string, unknown> = { strict: true, noUncheckedIndexedAccess: true, strictNullChecks: false };
        const entries = checkStrictFlags(opts, "tsconfig.json");
        expect(entries).toHaveLength(1);
        expect(entries[0]?.detail).toContain("strictNullChecks");
    });

    it("flags noUncheckedIndexedAccess when absent even under strict", () => {
        const opts: Record<string, unknown> = { strict: true };
        const entries = checkStrictFlags(opts, "tsconfig.json");
        expect(entries.some((e) => e.detail.includes("noUncheckedIndexedAccess"))).toBe(true);
    });

    it("parses JSONC with comments and trailing commas", () => {
        const src = '{\n  // a comment\n  "compilerOptions": {\n    "strict": true,\n  },\n}';
        expect(parseCompilerOptions(src)).toEqual({ strict: true });
    });
});

describe("collectArchitecture (fixture tree)", () => {
    let root: string;

    beforeAll(() => {
        root = mkdtempSync(path.join(tmpdir(), "arch-collector-"));
        mkdirSync(path.join(root, "src", "components", "premium"), { recursive: true });
        mkdirSync(path.join(root, "src", "features", "listings"), { recursive: true });
        mkdirSync(path.join(root, "src", "lib"), { recursive: true });

        // R2.1: domain logic outside src/features (a component touching the DB).
        writeFileSync(
            path.join(root, "src", "components", "premium", "loader.ts"),
            'export async function load() {\n  return supabase.from("listings").select("*");\n}\n',
            "utf8",
        );

        // R2.2: a "use client" component with no client-only behaviour.
        writeFileSync(
            path.join(root, "src", "components", "premium", "badge.tsx"),
            '"use client";\nexport function Badge({ label }: { label: string }) {\n  return <span className="badge">{label}</span>;\n}\n',
            "utf8",
        );

        // A legitimate client component (uses state) — must NOT be flagged for R2.2.
        writeFileSync(
            path.join(root, "src", "features", "listings", "counter.tsx"),
            '"use client";\nimport { useState } from "react";\nexport function Counter() {\n  const [n, setN] = useState(0);\n  return <button onClick={() => setN(n + 1)}>{n}</button>;\n}\n',
            "utf8",
        );

        // R2.5: an unjustified `any` in an allowed (lib) location is still flagged.
        writeFileSync(
            path.join(root, "src", "lib", "util.ts"),
            "export function pick(v: any) {\n  return v;\n}\n",
            "utf8",
        );

        // R2.6 fixture tsconfig: strict on but noUncheckedIndexedAccess missing.
        writeFileSync(
            path.join(root, "tsconfig.json"),
            '{\n  "compilerOptions": {\n    "strict": true\n  }\n}\n',
            "utf8",
        );
    });

    afterAll(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("emits architecture entries mapped to major/phase 2", () => {
        const entries = collectArchitecture({ rootDir: root });
        expect(entries.length).toBeGreaterThan(0);
        for (const entry of entries) {
            expect(entry.category).toBe("architecture");
            expect(entry.severity).toBe("major");
            expect(entry.owningPhase).toBe(2);
            expect(entry.filePaths).toHaveLength(1);
        }
    });

    it("flags the misplaced domain logic (R2.1)", () => {
        const entries = collectArchitecture({ rootDir: root });
        expect(entries.some((e) => e.filePaths[0] === "src/components/premium/loader.ts")).toBe(true);
    });

    it("flags the behaviourless use-client component but not the stateful one (R2.2)", () => {
        const entries = collectArchitecture({ rootDir: root });
        const rscViolations = entries.filter((e) => e.detail.includes("use client"));
        expect(rscViolations.map((e) => e.filePaths[0])).toContain("src/components/premium/badge.tsx");
        expect(rscViolations.map((e) => e.filePaths[0])).not.toContain("src/features/listings/counter.tsx");
    });

    it("flags the unjustified any (R2.5) and the missing strict flag (R2.6)", () => {
        const entries = collectArchitecture({ rootDir: root });
        expect(entries.some((e) => e.detail.includes("`any`"))).toBe(true);
        expect(entries.some((e) => e.detail.includes("noUncheckedIndexedAccess"))).toBe(true);
    });
});
