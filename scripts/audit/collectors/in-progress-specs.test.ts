/**
 * Unit tests for the in-progress spec collector (R1.9, R12.1–R12.4).
 *
 * Driven by an on-disk fixture spec tree so the collector exercises real
 * file-system reads. Asserts:
 *  - a spec whose every task is checked passes, with its referenced criteria
 *    reported pass and no Gap entries (R12.1);
 *  - a spec whose only incomplete tasks are optional (`*`) test sub-tasks still
 *    passes — those are not launch-required (R12.2) — while ownTasks.incomplete
 *    still counts them (R1.9);
 *  - a spec with an incomplete launch-required task fails and yields one
 *    `in-progress-spec` Gap entry with exactly one owning phase (R12.2/R1.8);
 *  - a spec with a missing/unreadable tasks list is recorded `audit-incomplete`
 *    (non-null reason, null owning phase) and is never marked passed (R12.3);
 *  - referenced criteria are identifiers only and never duplicated (R12.4).
 *
 * _Requirements: 1.9, 12.1, 12.2, 12.3, 12.4_
 */
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { collectInProgressSpecs, parseTasks } from "./in-progress-specs";

/** conversation-video-calling: every task checked (incl. optional `*` tests). */
const CVC_TASKS = `# Plan
## Tasks
- [x] 1. Migration
  - [x] 1.1 Author migration
  - [x]* 1.2 Property test
- [x] 2. Pure module
`;

/** mobile-map-discovery: only optional `*` test sub-tasks left unchecked. */
const MMD_TASKS = `# Plan
## Tasks
- [x] 1. Scaffolding
- [x] 2. Cap function
  - [x] 2.1 Implement cap
  - [ ]* 2.2 Property test for cap
- [x] 3. Sort
  - [ ]* 3.3 Property test for sort
`;

/** landlord-listing-management: a real (non-optional) incomplete task remains. */
const LLM_TASKS = `# Plan
## Tasks
- [x] 1. Schema
- [ ] 2. Publish/unpublish listing flow
  - [ ] 2.1 Wire publish action
`;

let repoRoot: string;
let specsDir: string;

beforeAll(async () => {
    repoRoot = await mkdtemp(path.join(tmpdir(), "in-progress-specs-"));
    specsDir = path.join(repoRoot, ".kiro", "specs");

    await mkdir(path.join(specsDir, "conversation-video-calling"), { recursive: true });
    await writeFile(path.join(specsDir, "conversation-video-calling", "tasks.md"), CVC_TASKS, "utf8");

    await mkdir(path.join(specsDir, "mobile-map-discovery"), { recursive: true });
    await writeFile(path.join(specsDir, "mobile-map-discovery", "tasks.md"), MMD_TASKS, "utf8");

    await mkdir(path.join(specsDir, "landlord-listing-management"), { recursive: true });
    await writeFile(path.join(specsDir, "landlord-listing-management", "tasks.md"), LLM_TASKS, "utf8");

    // discovery-pop: directory exists but tasks.md is intentionally absent.
    await mkdir(path.join(specsDir, "discovery-pop"), { recursive: true });
});

afterAll(async () => {
    await rm(repoRoot, { recursive: true, force: true });
});

describe("parseTasks", () => {
    it("parses checkbox state, optional marker, and numeric id", () => {
        const tasks = parseTasks(MMD_TASKS);
        expect(tasks).toHaveLength(6);

        const cap = tasks.find((t) => t.id === "2.1");
        expect(cap?.checked).toBe(true);
        expect(cap?.optional).toBe(false);

        const propTest = tasks.find((t) => t.id === "2.2");
        expect(propTest?.checked).toBe(false);
        expect(propTest?.optional).toBe(true);
    });

    it("ignores prose and headings", () => {
        const tasks = parseTasks("# Title\nSome prose.\n- [ ] 1. A task\n> a note");
        expect(tasks).toHaveLength(1);
        expect(tasks[0]?.id).toBe("1");
    });
});

describe("collectInProgressSpecs", () => {
    it("passes a spec whose tasks are all complete, with referenced criteria pass (R12.1)", () => {
        const { specResults, entries } = collectInProgressSpecs({ repoRoot, specsDir });
        const cvc = specResults.find((r) => r.spec === "conversation-video-calling");

        expect(cvc?.tasksFileFound).toBe(true);
        expect(cvc?.passed).toBe(true);
        expect(cvc?.ownTasks.incomplete).toBe(0);
        // Criteria referenced by identifier only (R12.4).
        expect(cvc?.referencedCriteria).toEqual(["4.12", "5.13", "5.14"]);
        expect(cvc?.criteriaResults.every((c) => c.result === "pass")).toBe(true);
        // No gaps for a fully complete spec.
        expect(entries.filter((e) => e.feature === "conversation-video-calling")).toHaveLength(0);
    });

    it("passes a spec whose only incomplete tasks are optional test sub-tasks (R12.2)", () => {
        const { specResults, entries } = collectInProgressSpecs({ repoRoot, specsDir });
        const mmd = specResults.find((r) => r.spec === "mobile-map-discovery");

        expect(mmd?.tasksFileFound).toBe(true);
        expect(mmd?.passed).toBe(true);
        // R1.9: the stale unchecked optional boxes are still counted as incomplete.
        expect(mmd?.ownTasks.incomplete).toBe(2);
        // Optional tasks are not launch-required, so no in-progress-spec gaps.
        expect(entries.filter((e) => e.feature === "mobile-map-discovery")).toHaveLength(0);
    });

    it("records an in-progress-spec gap with one owning phase for a launch-required incomplete task (R12.2/R1.8)", () => {
        const { specResults, entries } = collectInProgressSpecs({ repoRoot, specsDir });
        const llm = specResults.find((r) => r.spec === "landlord-listing-management");

        expect(llm?.tasksFileFound).toBe(true);
        expect(llm?.passed).toBe(false);
        expect(llm?.criteriaResults.every((c) => c.result === "fail")).toBe(true);

        const gaps = entries.filter((e) => e.feature === "landlord-listing-management");
        // Two non-optional incomplete tasks: "2." and "2.1".
        expect(gaps).toHaveLength(2);
        for (const gap of gaps) {
            expect(gap.category).toBe("in-progress-spec");
            expect(gap.owningPhase).toBe(4);
            expect(gap.reason).toBeNull();
            expect(["blocker", "major", "minor"]).toContain(gap.severity);
        }
    });

    it("records audit-incomplete and never passes a spec with a missing tasks list (R12.3)", () => {
        const { specResults, entries } = collectInProgressSpecs({ repoRoot, specsDir });
        const pop = specResults.find((r) => r.spec === "discovery-pop");

        expect(pop?.tasksFileFound).toBe(false);
        expect(pop?.passed).toBe(false);

        const incomplete = entries.filter(
            (e) => e.feature === "discovery-pop" && e.category === "audit-incomplete",
        );
        expect(incomplete).toHaveLength(1);
        expect(incomplete[0]?.reason).not.toBeNull();
        expect(incomplete[0]?.owningPhase).toBeNull();
    });

    it("evaluates all four specs and references criteria identifiers without duplication (R12.4)", () => {
        const { specResults } = collectInProgressSpecs({ repoRoot, specsDir });
        expect(specResults).toHaveLength(4);

        for (const result of specResults) {
            const unique = new Set(result.referencedCriteria);
            expect(unique.size).toBe(result.referencedCriteria.length);
        }
    });
});
