/**
 * Unit tests for the database-integrity collector (R9.1–R9.4, R9.6, R9.8, R9.9).
 *
 * Covers the pure statement splitter {@link splitSqlStatements} (dollar-quoted
 * bodies, comments, string literals) and the filesystem-backed
 * {@link collectDbIntegrity} against a fixture migration tree — asserting the
 * emitted entries are schema-valid, carry file paths, and that cross-migration
 * remediation (an index/policy added later) suppresses the corresponding gap.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GapEntry } from "../schema";
import { collectDbIntegrity, splitSqlStatements } from "./db-integrity";

describe("splitSqlStatements", () => {
    it("splits on top-level semicolons", () => {
        const stmts = splitSqlStatements("select 1; select 2;");
        expect(stmts).toEqual(["select 1", "select 2"]);
    });

    it("does not split on semicolons inside a dollar-quoted function body", () => {
        const sql = [
            "create function f() returns trigger as $$",
            "begin",
            "  new.updated_at = now();",
            "  return new;",
            "end;",
            "$$ language plpgsql;",
            "select 1;",
        ].join("\n");
        const stmts = splitSqlStatements(sql);
        expect(stmts).toHaveLength(2);
        expect(stmts[0]).toContain("create function");
        expect(stmts[1]).toBe("select 1");
    });

    it("ignores semicolons in line comments, block comments, and string literals", () => {
        const sql = [
            "-- a comment; with a semicolon",
            "/* block; comment */",
            "insert into t values ('a;b');",
            "select 2;",
        ].join("\n");
        const stmts = splitSqlStatements(sql);
        expect(stmts).toHaveLength(2);
        expect(stmts[0]).toContain("insert into t");
        expect(stmts[1]).toBe("select 2");
    });
});

describe("collectDbIntegrity", () => {
    let root: string;
    let migrationsDir: string;

    beforeAll(() => {
        root = mkdtempSync(join(tmpdir(), "db-integrity-"));
        migrationsDir = join(root, "supabase", "migrations");
        mkdirSync(migrationsDir, { recursive: true });

        // Migration 1: a table with a relationship column lacking an FK + index,
        // a spatial column, an RLS-enabled table missing several policies, a
        // camelCase column (naming), and a function with no security context.
        writeFileSync(
            join(migrationsDir, "20260101000000_init.sql"),
            [
                "create table public.listings (",
                "  id uuid primary key default gen_random_uuid(),",
                "  owner_id uuid not null,",
                '  "createdAt" timestamptz not null default now(),',
                "  location geometry(point, 4326) not null",
                ");",
                "",
                "alter table public.listings enable row level security;",
                "",
                'create policy "read listings" on public.listings for select using (true);',
                "",
                "create or replace function public.touch_listing()",
                "returns trigger language plpgsql as $$",
                "begin new.updated_at = now(); return new; end;",
                "$$;",
            ].join("\n"),
            "utf8",
        );

        // Migration 2 (later): add the spatial GIST index for listings.location,
        // proving a later migration remedies an earlier table's gap.
        writeFileSync(
            join(migrationsDir, "20260102000000_add_spatial_index.sql"),
            "create index listings_location_gix on public.listings using gist (location);\n",
            "utf8",
        );
    });

    afterAll(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("emits only schema-valid db-integrity entries carrying repo-relative file paths", () => {
        const entries = collectDbIntegrity({ migrationsDir, repoRoot: root });
        expect(entries.length).toBeGreaterThan(0);
        for (const entry of entries) {
            expect(() => GapEntry.parse(entry)).not.toThrow();
            expect(entry.category).toBe("db-integrity");
            expect(entry.filePaths).toHaveLength(1);
            expect(entry.filePaths[0]?.startsWith("supabase/migrations/")).toBe(true);
            // owningPhase is clamped into the schema's 2–8 range (severity maps db → 9).
            expect(entry.owningPhase).toBe(8);
        }
    });

    it("flags a relationship column lacking a foreign key (R9.1/R9.2) as a blocker", () => {
        const entries = collectDbIntegrity({ migrationsDir, repoRoot: root });
        const fkGap = entries.find((e) => /foreign key/i.test(e.detail) && /owner_id/.test(e.detail));
        expect(fkGap).toBeDefined();
        expect(fkGap?.severity).toBe("blocker");
    });

    it("flags a relationship column lacking a covering index (R9.3) as major", () => {
        const entries = collectDbIntegrity({ migrationsDir, repoRoot: root });
        const idxGap = entries.find((e) => /covering index/i.test(e.detail) && /owner_id/.test(e.detail));
        expect(idxGap).toBeDefined();
        expect(idxGap?.severity).toBe("major");
    });

    it("suppresses the spatial-index gap once a later migration adds the GIST index (R9.3)", () => {
        const entries = collectDbIntegrity({ migrationsDir, repoRoot: root });
        expect(entries.some((e) => /spatial/i.test(e.detail))).toBe(false);
    });

    it("flags RLS-enabled tables missing insert/update/delete policies (R9.6) as blockers", () => {
        const entries = collectDbIntegrity({ migrationsDir, repoRoot: root });
        const rlsGaps = entries.filter((e) => /RLS enabled/i.test(e.detail));
        const ops = rlsGaps.map((e) => e.detail.match(/no policy granting (\w+) access/i)?.[1]).filter(Boolean);
        expect(ops).toEqual(expect.arrayContaining(["INSERT", "UPDATE", "DELETE"]));
        // SELECT is covered by the one policy, so it must not be flagged.
        expect(ops).not.toContain("SELECT");
        for (const gap of rlsGaps) {
            expect(gap.severity).toBe("blocker");
        }
    });

    it("flags a camelCase column as a naming deviation (R9.8) with minor severity", () => {
        const entries = collectDbIntegrity({ migrationsDir, repoRoot: root });
        const namingGap = entries.find((e) => /naming convention/i.test(e.detail) && /createdAt/.test(e.detail));
        expect(namingGap).toBeDefined();
        expect(namingGap?.severity).toBe("minor");
    });

    it("flags a function without an explicit security context (R9.9)", () => {
        const entries = collectDbIntegrity({ migrationsDir, repoRoot: root });
        const secGap = entries.find((e) => /security invoker or security definer/i.test(e.detail));
        expect(secGap).toBeDefined();
    });

    it("is deterministic across runs (stable ids and order)", () => {
        const a = collectDbIntegrity({ migrationsDir, repoRoot: root });
        const b = collectDbIntegrity({ migrationsDir, repoRoot: root });
        expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
    });

    it("returns [] when the migrations directory does not exist", () => {
        expect(collectDbIntegrity({ migrationsDir: join(root, "nope"), repoRoot: root })).toEqual([]);
    });
});
