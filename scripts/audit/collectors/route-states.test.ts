/**
 * Unit tests for the route-state collector (R1.4) and its R1.10 self-report path.
 *
 * Driven by an on-disk fixture App Router tree so the collector exercises real
 * file-system enumeration and boundary-inheritance resolution. Asserts:
 *  - a route with no boundary files and no in-component states is flagged for
 *    all three missing states, each naming exactly one of loading/empty/error
 *    (R1.4);
 *  - `loading.tsx` / `error.tsx` boundary files satisfy the owning segment and
 *    every descendant segment (App Router inheritance);
 *  - in-component equivalents (Suspense fallback, empty-results branch, catch
 *    handler) satisfy the corresponding states;
 *  - `api` route handlers are excluded (not user-facing rendered routes);
 *  - every emitted `missing-route-state` entry is a well-formed Gap_Report entry
 *    mapped to phase 6, with a non-null `missingState`;
 *  - a reachable route whose page file cannot be read self-reports as
 *    `audit-incomplete` with a non-null reason and a null owning phase (R1.10).
 *
 * _Requirements: 1.4, 1.10_
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GapEntry, type GapEntry as GapEntryType } from "../schema";
import { collectRouteStates } from "./route-states";

let repoRoot: string;
let appDir: string;

beforeAll(() => {
    repoRoot = mkdtempSync(path.join(tmpdir(), "route-states-"));
    appDir = path.join(repoRoot, "src", "app");

    const write = (rel: string, body: string) => {
        const abs = path.join(appDir, rel);
        mkdirSync(path.dirname(abs), { recursive: true });
        writeFileSync(abs, body, "utf8");
    };

    // Root layout (not a page — must be ignored).
    write("layout.tsx", "export default function Layout({ children }: { children: unknown }) { return children; }\n");

    // Root route "/": bare page, no boundaries, no in-component states.
    // → missing loading, empty, AND error (3 entries).
    write("page.tsx", "export default function Home() { return <main>Home</main>; }\n");

    // Dashboard subtree: loading + error boundary files cover the segment and
    // all descendants. The dashboard page itself has no empty state.
    write("dashboard/loading.tsx", "export default function Loading() { return <div>Loading…</div>; }\n");
    write("dashboard/error.tsx", '"use client";\nexport default function Error() { return <div>Error</div>; }\n');
    write("dashboard/page.tsx", "export default function Dashboard() { return <section>Dashboard</section>; }\n");

    // Descendant of dashboard: inherits the ancestor loading/error boundaries,
    // so it should only be missing the empty state.
    write(
        "dashboard/listings/page.tsx",
        "export default function Listings() { return <ul>listings</ul>; }\n",
    );

    // A self-sufficient route: in-component loading (Suspense fallback), empty
    // branch (EmptyState), and error handling (catch). → no entries.
    write(
        "saved/page.tsx",
        [
            "import { Suspense } from 'react';",
            "export default function Saved() {",
            "  try {",
            "    const items: string[] = load();",
            "    return (",
            "      <Suspense fallback={<Skeleton />}>",
            "        {items.length === 0 ? <EmptyState /> : <List items={items} />}",
            "      </Suspense>",
            "    );",
            "  } catch (e) {",
            "    return <div>failed</div>;",
            "  }",
            "}",
        ].join("\n"),
    );

    // API route handler: must be excluded from route-state analysis.
    write("api/things/route.ts", "export async function GET() { return Response.json([]); }\n");

    // R1.10: a malformed page that is itself a *directory* cannot be read,
    // so the reachable route self-reports as audit-incomplete.
    mkdirSync(path.join(appDir, "broken", "page.tsx"), { recursive: true });
});

afterAll(() => {
    rmSync(repoRoot, { recursive: true, force: true });
});

/** All entries collected against the fixture tree (computed once per assertion). */
const collect = (): GapEntryType[] => collectRouteStates({ appDir, repoRoot });

describe("collectRouteStates — missing route states (R1.4)", () => {
    it("flags all three states for a bare route with no boundaries or in-component states", () => {
        const root = collect().filter((e) => e.filePaths[0] === "src/app/page.tsx");
        expect(root.map((e) => e.missingState).sort()).toEqual(["empty", "error", "loading"]);
        for (const entry of root) {
            expect(entry.category).toBe("missing-route-state");
        }
    });

    it("treats loading.tsx / error.tsx boundaries as covering the owning segment", () => {
        const dashboard = collect().filter((e) => e.filePaths[0] === "src/app/dashboard/page.tsx");
        // loading + error are satisfied by the co-located boundary files.
        expect(dashboard.map((e) => e.missingState)).toEqual(["empty"]);
    });

    it("inherits ancestor boundary files into descendant segments", () => {
        const listings = collect().filter((e) => e.filePaths[0] === "src/app/dashboard/listings/page.tsx");
        // Only the empty state remains; loading/error inherited from dashboard.
        expect(listings.map((e) => e.missingState)).toEqual(["empty"]);
    });

    it("recognises in-component loading/empty/error equivalents", () => {
        const saved = collect().filter((e) => e.filePaths[0] === "src/app/saved/page.tsx");
        expect(saved).toHaveLength(0);
    });

    it("excludes API route handlers from route-state analysis", () => {
        const apiEntries = collect().filter((e) => e.filePaths[0]?.includes("/api/"));
        expect(apiEntries).toHaveLength(0);
    });

    it("emits well-formed entries: one missingState each, phase 6, schema-valid", () => {
        const routeStateEntries = collect().filter((e) => e.category === "missing-route-state");
        expect(routeStateEntries.length).toBeGreaterThan(0);
        for (const entry of routeStateEntries) {
            expect(() => GapEntry.parse(entry)).not.toThrow();
            expect(entry.missingState).not.toBeNull();
            expect(["loading", "empty", "error"]).toContain(entry.missingState);
            expect(entry.owningPhase).toBe(6);
            expect(entry.filePaths).toHaveLength(1);
            expect(entry.missingObservability).toBeNull();
            expect(entry.reason).toBeNull();
            // A missing error state is more impactful (major) than loading/empty (minor).
            expect(entry.severity).toBe(entry.missingState === "error" ? "major" : "minor");
        }
    });

    it("is deterministic across runs (stable ids)", () => {
        expect(collect().map((e) => e.id)).toEqual(collect().map((e) => e.id));
    });
});

describe("collectRouteStates — audit-incomplete self-report (R1.10)", () => {
    it("records an audit-incomplete entry for a reachable route whose page cannot be read", () => {
        const incomplete = collect().filter((e) => e.category === "audit-incomplete");
        expect(incomplete).toHaveLength(1);

        const [entry] = incomplete;
        expect(() => GapEntry.parse(entry)).not.toThrow();
        // R1.10: file path + a non-null reason explaining why it could not be analysed.
        expect(entry?.filePaths).toEqual(["src/app/broken/page.tsx"]);
        expect(entry?.reason).not.toBeNull();
        expect(entry?.reason).toContain("could not be read");
        // R1.8: audit-incomplete entries carry no owning phase.
        expect(entry?.owningPhase).toBeNull();
        // The unanalysable route must NOT also produce missing-route-state entries.
        const brokenRouteStates = collect().filter(
            (e) => e.filePaths[0] === "src/app/broken/page.tsx" && e.category === "missing-route-state",
        );
        expect(brokenRouteStates).toHaveLength(0);
    });
});

describe("collectRouteStates — empty app dir", () => {
    it("returns [] when the app directory does not exist", () => {
        expect(collectRouteStates({ appDir: path.join(repoRoot, "nope"), repoRoot })).toEqual([]);
    });
});
