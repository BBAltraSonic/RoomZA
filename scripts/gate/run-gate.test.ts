// Feature: production-readiness-hardening, Task 18.1
import { describe, expect, it } from "vitest";

import {
    CheckResult,
    ReleaseReport,
    buildReleaseReport,
    deriveBlockingIssues,
    parseFailingTestCount,
    type CheckResult as CheckResultType,
} from "./run-gate";

const GENERATED_AT = "2026-07-02T14:10:42.682Z";
const COMMIT = "test-commit";

function check(input: Partial<CheckResultType> & Pick<CheckResultType, "id" | "criterion" | "passed">): CheckResultType {
    return CheckResult.parse({
        findings: [],
        error: null,
        ...input,
    });
}

describe("Release_Gate aggregation (R11.9, R11.10)", () => {
    it("passes only when no check creates a blocking issue", () => {
        const report = buildReleaseReport(
            [
                check({ id: "typescript", criterion: "11.1", passed: true }),
                check({ id: "eslint", criterion: "11.2", passed: true }),
            ],
            { generatedAt: GENERATED_AT, commit: COMMIT },
        );

        expect(report.verdict).toBe("passed");
        expect(report.blockingIssues).toEqual([]);
    });

    it("turns each failed finding into a blocking issue with the originating criterion", () => {
        const findings = [
            { location: "src/app/page.tsx", detail: "unresolved placeholder" },
            { location: "src/app/listings/page.tsx", detail: "mock response" },
        ];
        const failed = check({
            id: "placeholders",
            criterion: "11.5",
            passed: false,
            findings,
        });

        const report = buildReleaseReport([failed], { generatedAt: GENERATED_AT, commit: COMMIT });
        const firstFinding = findings[0];
        const secondFinding = findings[1];

        expect(firstFinding).toBeDefined();
        expect(secondFinding).toBeDefined();

        expect(report.verdict).toBe("failed");
        expect(report.blockingIssues).toEqual([
            { criterion: "11.5", location: firstFinding!.location, detail: firstFinding!.detail },
            { criterion: "11.5", location: secondFinding!.location, detail: secondFinding!.detail },
        ]);
        expect(report.checks[0]?.findings).toEqual(findings);
    });

    it("fails closed when a check errors, even if it has no findings", () => {
        const report = buildReleaseReport(
            [
                check({
                    id: "links",
                    criterion: "11.7",
                    passed: false,
                    error: "crawler crashed",
                }),
            ],
            { generatedAt: GENERATED_AT, commit: COMMIT },
        );

        expect(report.verdict).toBe("failed");
        expect(report.blockingIssues).toEqual([
            {
                criterion: "11.7",
                location: "links",
                detail: "Check links errored: crawler crashed",
            },
        ]);
    });

    it("creates a blocking issue for a failed check without findings", () => {
        expect(
            deriveBlockingIssues([
                check({
                    id: "tests",
                    criterion: "11.3",
                    passed: false,
                }),
            ]),
        ).toEqual([
            {
                criterion: "11.3",
                location: "tests",
                detail: "Check tests failed without findings.",
            },
        ]);
    });

    it("rejects an errored check marked as passed", () => {
        expect(() =>
            CheckResult.parse({
                id: "console-hydration",
                criterion: "11.4",
                passed: true,
                findings: [],
                error: "playwright failed to start",
            }),
        ).toThrow();
    });

    it("rejects a report whose verdict does not match blocking issues", () => {
        expect(() =>
            ReleaseReport.parse({
                generatedAt: GENERATED_AT,
                commit: COMMIT,
                checks: [],
                blockingIssues: [{ criterion: "11.1", location: "typescript", detail: "typecheck failed" }],
                verdict: "passed",
            }),
        ).toThrow();
    });
});

describe("test-stage failing-count parsing (R11.3, R10.8)", () => {
    it("parses the CI wrapper failing-test-count notice first", () => {
        expect(parseFailingTestCount("[ci:test-stage] vitest failing-test-count=4")).toBe(4);
    });

    it("parses Vitest failed test counts", () => {
        expect(parseFailingTestCount(" Tests  3 failed | 27 passed")).toBe(3);
    });

    it("parses Playwright failed test counts", () => {
        expect(parseFailingTestCount("\n  2 failed\n  12 passed")).toBe(2);
    });

    it("falls back to failed test-file counts", () => {
        expect(parseFailingTestCount(" Test Files  1 failed | 79 passed")).toBe(1);
    });

    it("returns zero when no failure count is present", () => {
        expect(parseFailingTestCount(" Test Files  80 passed\n Tests  480 passed")).toBe(0);
    });
});
