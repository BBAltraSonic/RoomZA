/**
 * Release_Gate report schema and fail-safe verdict aggregation (R11.9, R11.10).
 *
 * The gate is intentionally derived from check results, not from task checkboxes.
 * Any failed or errored check produces at least one blocking issue, and the
 * release verdict is `passed` iff that blocking-issue list is empty.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { collectPlaceholders } from "../audit/collectors/placeholders";
import { collectRouteStates } from "../audit/collectors/route-states";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SPEC_DIR = path.join(REPO_ROOT, ".kiro", "specs", "production-readiness-hardening");
const RELEASE_REPORT_PATH = path.join(SPEC_DIR, "release-report.json");

export const CheckId = z.enum([
    "typescript",
    "eslint",
    "tests",
    "console-hydration",
    "placeholders",
    "todos",
    "links",
    "duplicate-requests",
    "race-conditions",
    "memory-leaks",
    "secret-leaks",
]);
export type CheckId = z.infer<typeof CheckId>;

export const CheckFinding = z.object({
    location: z.string(),
    detail: z.string(),
});
export type CheckFinding = z.infer<typeof CheckFinding>;

export const CheckResult = z
    .object({
        id: CheckId,
        /** Originating requirement criterion, e.g. "11.1". */
        criterion: z.string().min(1),
        passed: z.boolean(),
        /** Retained unmodified on failure (R11.9). */
        findings: z.array(CheckFinding),
        /** Non-null means the check itself errored and must fail closed. */
        error: z.string().min(1).nullable().default(null),
    })
    .superRefine((result, ctx) => {
        if (result.passed && result.error !== null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["passed"],
                message: "errored checks cannot be marked passed",
            });
        }
    });
export type CheckResult = z.infer<typeof CheckResult>;

export const BlockingIssue = z.object({
    criterion: z.string().min(1),
    location: z.string().min(1),
    detail: z.string().min(1),
});
export type BlockingIssue = z.infer<typeof BlockingIssue>;

export const ReleaseReport = z
    .object({
        generatedAt: z.string().datetime(),
        commit: z.string().min(1),
        checks: z.array(CheckResult),
        blockingIssues: z.array(BlockingIssue),
        verdict: z.enum(["passed", "failed"]),
    })
    .superRefine((report, ctx) => {
        const expectedVerdict = report.blockingIssues.length === 0 ? "passed" : "failed";
        if (report.verdict !== expectedVerdict) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["verdict"],
                message: "verdict must be passed iff blockingIssues is empty",
            });
        }
    });
export type ReleaseReport = z.infer<typeof ReleaseReport>;

export interface BuildReleaseReportOptions {
    readonly generatedAt?: string;
    readonly commit?: string;
}

interface CommandResult {
    readonly command: string;
    readonly args: readonly string[];
    readonly exitCode: number;
    readonly timedOut: boolean;
    readonly output: string;
}

interface TestStageResult {
    readonly stage: "vitest" | "playwright";
    readonly command: CommandResult;
    readonly failingTestCount: number;
}

const COMMAND_TIMEOUT_MS = 20 * 60 * 1000;

function resolveCommit(): string {
    try {
        return execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: REPO_ROOT,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch {
        return "unknown";
    }
}

function npmCommand(): string {
    return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npxCommand(): string {
    return process.platform === "win32" ? "npx.cmd" : "npx";
}

function outputTail(output: string, maxLength = 2_000): string {
    const trimmed = output.trim();
    if (trimmed.length <= maxLength) return trimmed;
    return trimmed.slice(trimmed.length - maxLength);
}

async function runCommand(command: string, args: readonly string[], timeoutMs = COMMAND_TIMEOUT_MS): Promise<CommandResult> {
    return new Promise((resolve) => {
        let output = "";
        let timedOut = false;

        const child = spawn(command, [...args], {
            cwd: REPO_ROOT,
            shell: process.platform === "win32",
            stdio: ["ignore", "pipe", "pipe"],
            env: process.env,
        });

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
            setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
        }, timeoutMs);

        child.stdout.on("data", (chunk) => {
            output += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
            output += chunk.toString();
        });
        child.on("error", (error) => {
            output += `\n${error instanceof Error ? error.message : String(error)}`;
        });
        child.on("close", (code, signal) => {
            clearTimeout(timer);
            const exitCode = timedOut || signal ? 1 : code ?? 1;
            resolve({ command, args, exitCode, timedOut, output });
        });
    });
}

export function parseFailingTestCount(output: string): number {
    const ciStage = /failing-test-count=(\d+)/i.exec(output);
    if (ciStage?.[1]) return Number(ciStage[1]);

    const vitest = /Tests\s+(\d+)\s+failed/i.exec(output);
    if (vitest?.[1]) return Number(vitest[1]);

    const playwright = /(?:^|\n)\s*(\d+)\s+failed(?:\s|\(|$)/i.exec(output);
    if (playwright?.[1]) return Number(playwright[1]);

    const failedFiles = /Test Files\s+(\d+)\s+failed/i.exec(output);
    if (failedFiles?.[1]) return Number(failedFiles[1]);

    return 0;
}

function checkFromCommand(input: {
    id: CheckId;
    criterion: string;
    commandResult: CommandResult;
    failureDetail: string;
}): CheckResult {
    const passed = input.commandResult.exitCode === 0 && !input.commandResult.timedOut;
    return CheckResult.parse({
        id: input.id,
        criterion: input.criterion,
        passed,
        findings: passed
            ? []
            : [
                  {
                      location: `${input.commandResult.command} ${input.commandResult.args.join(" ")}`.trim(),
                      detail: `${input.failureDetail}${input.commandResult.timedOut ? " Command timed out." : ""}${
                          outputTail(input.commandResult.output) ? `\n${outputTail(input.commandResult.output)}` : ""
                      }`,
                  },
              ],
        error: null,
    });
}

export async function runTypeScriptCheck(): Promise<CheckResult> {
    const result = await runCommand(npmCommand(), ["run", "typecheck"]);
    return checkFromCommand({
        id: "typescript",
        criterion: "11.1",
        commandResult: result,
        failureDetail: "TypeScript check failed.",
    });
}

export async function runEslintCheck(): Promise<CheckResult> {
    const result = await runCommand(npmCommand(), ["run", "lint"]);
    return checkFromCommand({
        id: "eslint",
        criterion: "11.2",
        commandResult: result,
        failureDetail: "ESLint check failed.",
    });
}

function testStageFinding(stage: TestStageResult): CheckFinding | null {
    if (stage.command.exitCode === 0 && stage.failingTestCount === 0 && !stage.command.timedOut) return null;

    return {
        location: stage.stage,
        detail:
            `${stage.stage} failing-test-count=${stage.failingTestCount}` +
            `${stage.command.timedOut ? "; command timed out" : ""}` +
            `${outputTail(stage.command.output) ? `\n${outputTail(stage.command.output)}` : ""}`,
    };
}

async function runTestStage(stage: TestStageResult["stage"], script: "test:ci" | "test:e2e:ci"): Promise<TestStageResult> {
    const command = await runCommand(npmCommand(), ["run", script]);
    let failingTestCount = parseFailingTestCount(command.output);
    if (command.timedOut || (command.exitCode !== 0 && failingTestCount === 0)) {
        failingTestCount = 1;
    }

    return { stage, command, failingTestCount };
}

export async function runTestsCheck(): Promise<CheckResult> {
    const stages = [
        await runTestStage("vitest", "test:ci"),
        await runTestStage("playwright", "test:e2e:ci"),
    ];
    const findings = stages.flatMap((stage) => {
        const finding = testStageFinding(stage);
        return finding === null ? [] : [finding];
    });
    const failingTestCount = stages.reduce((sum, stage) => sum + stage.failingTestCount, 0);

    return CheckResult.parse({
        id: "tests",
        criterion: "11.3,10.8",
        passed: findings.length === 0 && failingTestCount === 0,
        findings,
        error: null,
    });
}

export async function runConsoleHydrationCheck(): Promise<CheckResult> {
    const result = await runCommand(npxCommand(), ["playwright", "test", "e2e/roomza-console-hydration.spec.ts"]);
    return checkFromCommand({
        id: "console-hydration",
        criterion: "11.4",
        commandResult: result,
        failureDetail: "Console error or hydration warning detected during CUJ coverage.",
    });
}

export async function runLinksCheck(): Promise<CheckResult> {
    const result = await runCommand(npxCommand(), ["playwright", "test", "e2e/roomza-links.spec.ts"]);
    return checkFromCommand({
        id: "links",
        criterion: "11.7",
        commandResult: result,
        failureDetail: "Reachable route or navigation link resolved to a missing route.",
    });
}

function findingFromGap(entry: { filePaths: readonly string[]; detail: string; feature: string }): CheckFinding {
    return {
        location: entry.filePaths[0] ?? entry.feature,
        detail: entry.detail,
    };
}

export function runPlaceholdersCheck(): CheckResult {
    const placeholderEntries = collectPlaceholders({
        srcDir: path.join(REPO_ROOT, "src"),
        repoRoot: REPO_ROOT,
    }).filter((entry) => !entry.detail.startsWith("TODO/FIXME marker"));
    const unanalysableRouteEntries = collectRouteStates({
        appDir: path.join(REPO_ROOT, "src", "app"),
        repoRoot: REPO_ROOT,
    }).filter((entry) => entry.category === "audit-incomplete");
    const findings = [...placeholderEntries.map(findingFromGap), ...unanalysableRouteEntries.map(findingFromGap)];

    return CheckResult.parse({
        id: "placeholders",
        criterion: "11.5",
        passed: findings.length === 0,
        findings,
        error: null,
    });
}

export function runTodosCheck(): CheckResult {
    const findings = collectPlaceholders({
        srcDir: path.join(REPO_ROOT, "src"),
        repoRoot: REPO_ROOT,
    })
        .filter((entry) => entry.detail.startsWith("TODO/FIXME marker"))
        .map(findingFromGap);

    return CheckResult.parse({
        id: "todos",
        criterion: "11.6",
        passed: findings.length === 0,
        findings,
        error: null,
    });
}

function blockingIssuesForCheck(check: CheckResult): BlockingIssue[] {
    if (check.passed && check.error === null) return [];

    if (check.findings.length > 0) {
        return check.findings.map((finding) => ({
            criterion: check.criterion,
            location: finding.location,
            detail: finding.detail,
        }));
    }

    const detail = check.error === null ? `Check ${check.id} failed without findings.` : `Check ${check.id} errored: ${check.error}`;
    return [{ criterion: check.criterion, location: check.id, detail }];
}

export function deriveBlockingIssues(checks: readonly CheckResult[]): BlockingIssue[] {
    return checks.flatMap((check) => blockingIssuesForCheck(CheckResult.parse(check)));
}

export function buildReleaseReport(
    checksInput: readonly CheckResult[],
    options: BuildReleaseReportOptions = {},
): ReleaseReport {
    const checks = checksInput.map((check) => CheckResult.parse(check));
    const blockingIssues = deriveBlockingIssues(checks);
    const verdict = blockingIssues.length === 0 ? "passed" : "failed";

    return ReleaseReport.parse({
        generatedAt: options.generatedAt ?? new Date().toISOString(),
        commit: options.commit ?? resolveCommit(),
        checks,
        blockingIssues,
        verdict,
    });
}

export function writeReleaseReport(report: ReleaseReport): void {
    mkdirSync(SPEC_DIR, { recursive: true });
    writeFileSync(RELEASE_REPORT_PATH, `${JSON.stringify(ReleaseReport.parse(report), null, 2)}\n`, "utf8");
}

export async function runGate(): Promise<ReleaseReport> {
    const staticChecks = await Promise.all([runTypeScriptCheck(), runEslintCheck()]);
    const checks = [
        ...staticChecks,
        await runTestsCheck(),
        await runConsoleHydrationCheck(),
        runPlaceholdersCheck(),
        runTodosCheck(),
        await runLinksCheck(),
    ];
    const report = buildReleaseReport(checks);
    writeReleaseReport(report);
    return report;
}

async function main(): Promise<void> {
    const report = await runGate();
    process.stdout.write(
        `Release gate ${report.verdict}: ${report.blockingIssues.length} blocking issue(s).\n` +
            `  -> ${path.relative(REPO_ROOT, RELEASE_REPORT_PATH)}\n`,
    );
    if (report.verdict === "failed") {
        process.exitCode = 1;
    }
}

const invokedDirectly =
    process.argv[1] !== undefined &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    main().catch((error: unknown) => {
        process.stderr.write(`Release gate failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
