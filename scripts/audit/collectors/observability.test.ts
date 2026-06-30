/**
 * Unit tests for the observability collector (R1.6).
 *
 * Covers the pure source analysis (`analyzeObservability`/`stripComments`) and
 * the collector's entry shape against a fixture tree, including the invariant
 * that every emitted entry names exactly one absent observability concern.
 *
 * _Requirements: 1.6_
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { analyzeObservability, collectObservabilityGaps, stripComments } from "./observability";

describe("stripComments", () => {
    it("removes block and line comments", () => {
        const out = stripComments("a; /* logger.info() */ b; // analytics_events\nc;");
        expect(out).not.toContain("logger.info");
        expect(out).not.toContain("analytics_events");
        expect(out).toContain("a;");
        expect(out).toContain("c;");
    });

    it("preserves URLs containing //", () => {
        expect(stripComments('const u = "https://meet.jit.si";')).toContain("https://meet.jit.si");
    });
});

describe("analyzeObservability", () => {
    it("detects a structured logger call", () => {
        expect(analyzeObservability('logger.error("x", { e });').hasLogging).toBe(true);
    });

    it("detects an analytics_events write", () => {
        expect(analyzeObservability('supabase.from("analytics_events").insert({});').hasAnalytics).toBe(true);
    });

    it("detects a monitoring capture", () => {
        expect(analyzeObservability("Sentry.captureException(err);").hasMonitoring).toBe(true);
    });

    it("does not count commented-out calls as coverage", () => {
        const source = "// logger.info('x')\n/* analytics_events */\nexport async function POST() {}";
        const coverage = analyzeObservability(source);
        expect(coverage.hasLogging).toBe(false);
        expect(coverage.hasAnalytics).toBe(false);
        expect(coverage.hasMonitoring).toBe(false);
    });
});

describe("collectObservabilityGaps", () => {
    let root: string;

    beforeAll(() => {
        root = mkdtempSync(path.join(tmpdir(), "obs-collector-"));
        const apiDir = path.join(root, "src", "app", "api", "things");
        const actionsDir = path.join(root, "src", "features", "things");
        mkdirSync(apiDir, { recursive: true });
        mkdirSync(actionsDir, { recursive: true });

        // API route with logging only → missing analytics + monitoring.
        writeFileSync(
            path.join(apiDir, "route.ts"),
            'import { logger } from "@/lib/logger";\nexport async function GET() { logger.info("hit"); }\n',
            "utf8",
        );
        // Server action with full coverage → no entries.
        writeFileSync(
            path.join(actionsDir, "actions.ts"),
            '"use server";\nimport { logger } from "@/lib/logger";\nexport async function act() {\n  logger.info("x");\n  Sentry.captureException(null);\n  supabase.from("analytics_events").insert({});\n}\n',
            "utf8",
        );
        // Server action with no coverage → missing all three.
        writeFileSync(
            path.join(actionsDir, "bare.ts"),
            '"use server";\nexport async function bare() { return 1; }\n',
            "utf8",
        );
        // Test file must be ignored even though it imports logger.
        writeFileSync(
            path.join(actionsDir, "actions.test.ts"),
            'import { logger } from "@/lib/logger";\nlogger.info("ignored");\n',
            "utf8",
        );
    });

    afterAll(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("emits one entry per absent concern and skips covered files", () => {
        const entries = collectObservabilityGaps({ rootDir: root });

        // route.ts: analytics + monitoring (2); bare.ts: all three (3); actions.ts: 0.
        expect(entries).toHaveLength(5);

        const byFile = (file: string) => entries.filter((e) => e.filePaths[0] === file);
        expect(byFile("src/app/api/things/route.ts").map((e) => e.missingObservability).sort()).toEqual([
            "analytics",
            "monitoring",
        ]);
        expect(byFile("src/features/things/bare.ts").map((e) => e.missingObservability).sort()).toEqual([
            "analytics",
            "logging",
            "monitoring",
        ]);
        expect(byFile("src/features/things/actions.ts")).toHaveLength(0);
    });

    it("classifies every entry as missing-observability with a non-null concern (R1.6)", () => {
        const entries = collectObservabilityGaps({ rootDir: root });
        expect(entries.length).toBeGreaterThan(0);
        for (const entry of entries) {
            expect(entry.category).toBe("missing-observability");
            expect(entry.missingObservability).not.toBeNull();
            expect(["analytics", "logging", "monitoring"]).toContain(entry.missingObservability);
            expect(entry.owningPhase).toBe(8);
            expect(entry.filePaths).toHaveLength(1);
        }
    });
});
