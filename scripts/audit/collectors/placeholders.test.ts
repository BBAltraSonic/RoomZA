/**
 * Unit tests for the placeholder collector (R1.3).
 *
 * Covers the pure line classifier {@link findPlaceholdersInSource} for each
 * placeholder kind plus the false-positive guards, and the filesystem-backed
 * {@link collectPlaceholders} against a fixture tree — asserting the emitted
 * entries are schema-valid, carry the file path, and that test files are skipped.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GapEntry } from "../schema";
import { collectPlaceholders, findPlaceholdersInSource } from "./placeholders";

describe("findPlaceholdersInSource", () => {
    it("detects TODO and FIXME markers", () => {
        const findings = findPlaceholdersInSource("// TODO: wire real data\nconst a = 1; // FIXME later");
        const kinds = findings.map((f) => f.kind);
        expect(kinds).toContain("todo-marker");
        expect(findings.filter((f) => f.kind === "todo-marker")).toHaveLength(2);
    });

    it("detects not-implemented throws in single and double quotes", () => {
        expect(
            findPlaceholdersInSource(`throw new Error("not implemented")`).some(
                (f) => f.kind === "not-implemented-throw",
            ),
        ).toBe(true);
        expect(
            findPlaceholdersInSource(`throw new Error('not yet implemented')`).some(
                (f) => f.kind === "not-implemented-throw",
            ),
        ).toBe(true);
    });

    it("detects commented-out logic but ignores prose and tooling directives", () => {
        const code = [
            "// const result = compute(x);",
            "// return result + 1;",
            "// this explains why the value is doubled",
            "// eslint-disable-next-line",
            "// https://example.com/docs",
        ].join("\n");
        const logic = findPlaceholdersInSource(code).filter((f) => f.kind === "commented-out-logic");
        expect(logic).toHaveLength(2);
        expect(logic.map((f) => f.line)).toEqual([1, 2]);
    });

    it("detects mock/hardcoded sample data signals", () => {
        const code = [
            "const mockData = [{ id: 1 }];",
            "const SAMPLE_LISTINGS = [];",
            "// this value is hardcoded for now",
            "const blurb = 'Lorem ipsum dolor sit amet';",
        ].join("\n");
        const mock = findPlaceholdersInSource(code).filter((f) => f.kind === "mock-data");
        expect(mock).toHaveLength(4);
    });

    it("does not flag the bare word 'placeholder' (e.g. input attributes)", () => {
        const findings = findPlaceholdersInSource(`<input placeholder="Search listings" />`);
        expect(findings).toHaveLength(0);
    });

    it("returns no findings for clean code", () => {
        expect(findPlaceholdersInSource("export const sum = (a: number, b: number) => a + b;")).toEqual([]);
    });
});

describe("collectPlaceholders", () => {
    let root: string;
    let srcDir: string;

    beforeAll(() => {
        root = mkdtempSync(join(tmpdir(), "placeholders-"));
        srcDir = join(root, "src");
        mkdirSync(join(srcDir, "features", "listings"), { recursive: true });
        mkdirSync(join(srcDir, "app"), { recursive: true });

        writeFileSync(
            join(srcDir, "features", "listings", "service.ts"),
            ["export function create() {", "  // TODO: persist to db", '  throw new Error("not implemented");', "}"].join("\n"),
            "utf8",
        );
        writeFileSync(
            join(srcDir, "app", "page.tsx"),
            ["const mockData = [{ id: 1 }];", "export default function Page() { return null; }"].join("\n"),
            "utf8",
        );
        // A test file containing mock data must be skipped.
        writeFileSync(join(srcDir, "app", "page.test.ts"), "const mockData = [];", "utf8");
    });

    afterAll(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("emits schema-valid placeholder entries carrying the file path", () => {
        const entries = collectPlaceholders({ srcDir, repoRoot: root });
        expect(entries.length).toBeGreaterThan(0);
        for (const entry of entries) {
            // Every emitted entry must satisfy the Gap_Report schema (R1.3, R1.8).
            expect(() => GapEntry.parse(entry)).not.toThrow();
            expect(entry.category).toBe("placeholder");
            expect(entry.filePaths).toHaveLength(1);
            expect(entry.severity).toBe("major");
            expect(entry.owningPhase).toBe(6);
        }
    });

    it("reports forward-slash repo-relative paths and a features label", () => {
        const entries = collectPlaceholders({ srcDir, repoRoot: root });
        const serviceEntry = entries.find((e) => e.filePaths[0]?.includes("listings/service.ts"));
        expect(serviceEntry).toBeDefined();
        expect(serviceEntry?.filePaths[0]).toBe("src/features/listings/service.ts");
        expect(serviceEntry?.feature).toBe("features/listings");
    });

    it("skips test files so expected mocks are not flagged", () => {
        const entries = collectPlaceholders({ srcDir, repoRoot: root });
        expect(entries.some((e) => e.filePaths[0]?.endsWith(".test.ts"))).toBe(false);
    });

    it("is deterministic across runs (stable ids)", () => {
        const a = collectPlaceholders({ srcDir, repoRoot: root });
        const b = collectPlaceholders({ srcDir, repoRoot: root });
        expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
    });
});
