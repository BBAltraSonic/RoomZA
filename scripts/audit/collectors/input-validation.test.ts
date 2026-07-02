/**
 * Unit tests for the input-validation collector (R1.5).
 *
 * Verifies the pure analysers classify each input boundary correctly, and that
 * the filesystem-walking collector emits well-formed `missing-validation`
 * Gap_Report entries against a fixture tree — including the case where an
 * API route, a Server Action, and an orphan form are all flagged while their
 * validated counterparts are not.
 *
 * _Requirements: 1.5_
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GapEntry } from "../schema";
import {
    analyzeApiRouteFile,
    analyzeFormFile,
    analyzeServerActionFile,
    collectInputValidationGaps,
    findMatchingBrace,
    formDelegatesToBoundary,
    handlerAcceptsInput,
    hasZodValidation,
    isServerActionFile,
} from "./input-validation";

describe("hasZodValidation", () => {
    it("detects safeParse, schema.parse, and zodResolver", () => {
        expect(hasZodValidation("const r = schema.safeParse(x);")).toBe(true);
        expect(hasZodValidation("const r = listingSchema.parse(x);")).toBe(true);
        expect(hasZodValidation("resolver: zodResolver(schema)")).toBe(true);
    });

    it("does not treat JSON.parse / Date.parse as Zod validation", () => {
        expect(hasZodValidation("const o = JSON.parse(body);")).toBe(false);
        expect(hasZodValidation("const t = Date.parse(s);")).toBe(false);
    });

    it("counts a bare .parse only when the file imports from zod", () => {
        expect(hasZodValidation('import { z } from "zod";\nconst v = mySchema.parse(x);')).toBe(true);
        expect(hasZodValidation("const v = something.parse(x);")).toBe(false);
    });
});

describe("findMatchingBrace", () => {
    it("matches across nested braces, strings, and template expressions", () => {
        const src = "{ a: `${ {x:1} }`, b: '}{' , c: { d: 2 } }X";
        const close = findMatchingBrace(src, 0);
        expect(src[close]).toBe("}");
        expect(src.slice(close + 1)).toBe("X");
    });
});

describe("handlerAcceptsInput", () => {
    it("is true for query/body/param reads and false for header-only handlers", () => {
        expect(handlerAcceptsInput("const { searchParams } = new URL(request.url);")).toBe(true);
        expect(handlerAcceptsInput("const body = await request.json();")).toBe(true);
        expect(handlerAcceptsInput("const { id } = await params;")).toBe(true);
        expect(handlerAcceptsInput("const h = request.headers.get('authorization');")).toBe(false);
    });
});

describe("isServerActionFile / formDelegatesToBoundary", () => {
    it("recognises the use server directive", () => {
        expect(isServerActionFile('"use server";\nexport async function a() {}')).toBe(true);
        expect(isServerActionFile("export async function a() {}")).toBe(false);
    });

    it("treats action bindings, action imports, and fetch as delegation", () => {
        expect(formDelegatesToBoundary("<form action={signOutAction}>")).toBe(true);
        expect(formDelegatesToBoundary('import { createListing } from "./actions";')).toBe(true);
        expect(formDelegatesToBoundary('await fetch("/api/alerts", {})')).toBe(true);
        expect(formDelegatesToBoundary("const x = 1;")).toBe(false);
    });
});

describe("analyzeApiRouteFile", () => {
    it("flags a handler that reads input without Zod", () => {
        const src = `
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return Response.json({ q: searchParams.get("q") });
}`;
        const entries = analyzeApiRouteFile("src/app/api/things/route.ts", src);
        expect(entries).toHaveLength(1);
        expect(entries[0]?.category).toBe("missing-validation");
        expect(entries[0]?.severity).toBe("blocker");
        expect(entries[0]?.owningPhase).toBe(8);
        expect(entries[0]?.filePaths).toEqual(["src/app/api/things/route.ts"]);
    });

    it("does not flag a handler that validates with Zod", () => {
        const src = `
import { z } from "zod";
const schema = z.object({ email: z.string() });
export async function POST(request: Request) {
  const body = schema.safeParse(await request.json());
  return Response.json(body);
}`;
        expect(analyzeApiRouteFile("src/app/api/things/route.ts", src)).toHaveLength(0);
    });

    it("does not flag a header-only handler (no user input)", () => {
        const src = `
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== process.env.CRON_SECRET) return new Response(null, { status: 401 });
  return Response.json({ ok: true });
}`;
        expect(analyzeApiRouteFile("src/app/api/cron/route.ts", src)).toHaveLength(0);
    });
});

describe("analyzeServerActionFile", () => {
    it("flags an input-accepting action without Zod, returning a Promise<{…}> type", () => {
        const src = `"use server";
export async function doThing(id: string): Promise<{ ok: boolean }> {
  return { ok: Boolean(id) };
}`;
        const entries = analyzeServerActionFile("src/features/x/actions.ts", src);
        expect(entries).toHaveLength(1);
        expect(entries[0]?.detail).toContain("doThing");
    });

    it("does not flag a no-argument action", () => {
        const src = `"use server";
export async function listAll() { return []; }`;
        expect(analyzeServerActionFile("src/features/x/actions.ts", src)).toHaveLength(0);
    });

    it("does not flag an action that validates FormData with Zod", () => {
        const src = `"use server";
import { schema } from "./schema";
export async function create(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  return parsed.success;
}`;
        expect(analyzeServerActionFile("src/features/x/actions.ts", src)).toHaveLength(0);
    });
});

describe("analyzeFormFile", () => {
    it("flags an orphan input form with no validation path", () => {
        const src = `export function F() {
  return (<form onSubmit={(e) => { e.preventDefault(); save(); }}><input name="a" /></form>);
}`;
        expect(analyzeFormFile("src/features/x/orphan-form.tsx", src)).toHaveLength(1);
    });

    it("does not flag a form that delegates to a Server Action", () => {
        const src = `import { createThing } from "./actions";
export function F() {
  return (<form onSubmit={() => createThing(new FormData())}><input name="a" /></form>);
}`;
        expect(analyzeFormFile("src/features/x/form.tsx", src)).toHaveLength(0);
    });

    it("does not flag a navigational search form", () => {
        const src = `export function F() {
  return (<form role="search" onSubmit={onSearch}><input name="q" /></form>);
}`;
        expect(analyzeFormFile("src/features/x/search.tsx", src)).toHaveLength(0);
    });
});

describe("collectInputValidationGaps (fixture tree)", () => {
    let root: string;

    beforeAll(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), "iv-collector-"));
        const write = async (rel: string, body: string) => {
            const abs = path.join(root, rel);
            await fs.mkdir(path.dirname(abs), { recursive: true });
            await fs.writeFile(abs, body, "utf8");
        };

        // Unvalidated API route → flagged.
        await write(
            "src/app/api/items/route.ts",
            `export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return Response.json({ q: searchParams.get("q") });
}`,
        );
        // Validated API route → not flagged.
        await write(
            "src/app/api/safe/route.ts",
            `import { z } from "zod";
const s = z.object({ a: z.string() });
export async function POST(request: Request) {
  const r = s.safeParse(await request.json());
  return Response.json(r);
}`,
        );
        // Unvalidated server action → flagged.
        await write(
            "src/features/widgets/actions.ts",
            `"use server";
export async function removeWidget(id: string) { return id; }`,
        );
        // Orphan form → flagged.
        await write(
            "src/features/widgets/orphan-form.tsx",
            `export function F() {
  return (<form onSubmit={(e) => { e.preventDefault(); }}><input name="a" /></form>);
}`,
        );
        // Test file → ignored by the walker.
        await write(
            "src/features/widgets/actions.test.ts",
            `"use server";
export async function ignored(id: string) { return id; }`,
        );
    });

    afterAll(async () => {
        await fs.rm(root, { recursive: true, force: true });
    });

    it("flags exactly the three unvalidated boundaries with valid entries", async () => {
        const entries = await collectInputValidationGaps({ repoRoot: root });

        const paths = entries.map((e) => e.filePaths[0]).sort();
        expect(paths).toEqual([
            "src/app/api/items/route.ts",
            "src/features/widgets/actions.ts",
            "src/features/widgets/orphan-form.tsx",
        ]);

        // Every emitted entry is a well-formed missing-validation gap.
        for (const entry of entries) {
            expect(() => GapEntry.parse(entry)).not.toThrow();
            expect(entry.category).toBe("missing-validation");
            expect(entry.owningPhase).toBe(8);
        }
    });

    it("produces stable ids across repeated runs", async () => {
        const first = await collectInputValidationGaps({ repoRoot: root });
        const second = await collectInputValidationGaps({ repoRoot: root });
        expect(first.map((e) => e.id).sort()).toEqual(second.map((e) => e.id).sort());
    });
});
