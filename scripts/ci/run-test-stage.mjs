import { spawn } from "node:child_process";

const separatorIndex = process.argv.indexOf("--");
const optionArgs = separatorIndex === -1 ? process.argv.slice(2) : process.argv.slice(2, separatorIndex);
const commandArgs = separatorIndex === -1 ? [] : process.argv.slice(separatorIndex + 1);

function optionValue(name, fallback) {
  const index = optionArgs.indexOf(name);
  return index >= 0 ? optionArgs[index + 1] ?? fallback : fallback;
}

const stage = optionValue("--stage", "test");
const stageTimeoutMs = Number(optionValue("--stage-timeout-ms", String(20 * 60 * 1000)));

if (commandArgs.length === 0) {
  console.error("Usage: node scripts/ci/run-test-stage.mjs --stage <name> -- <command> [args...]");
  process.exit(2);
}

const [command, ...args] = commandArgs;
let output = "";
let timedOut = false;

const child = spawn(command, args, {
  shell: process.platform === "win32",
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});

const timer = setTimeout(() => {
  timedOut = true;
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
}, stageTimeoutMs);

function collect(chunk, stream) {
  const text = chunk.toString();
  output += text;
  stream.write(text);
}

child.stdout.on("data", (chunk) => collect(chunk, process.stdout));
child.stderr.on("data", (chunk) => collect(chunk, process.stderr));

function parseFailingCount(text) {
  const vitest = /Tests\s+(\d+)\s+failed/i.exec(text);
  if (vitest?.[1]) return Number(vitest[1]);

  const playwright = /(?:^|\n)\s*(\d+)\s+failed(?:\s|\(|$)/i.exec(text);
  if (playwright?.[1]) return Number(playwright[1]);

  const failedFiles = /Test Files\s+(\d+)\s+failed/i.exec(text);
  if (failedFiles?.[1]) return Number(failedFiles[1]);

  return 0;
}

child.on("close", (code, signal) => {
  clearTimeout(timer);

  let failingCount = parseFailingCount(output);
  if (timedOut || (code !== 0 && failingCount === 0)) {
    failingCount = Math.max(failingCount, 1);
  }

  console.log(`[ci:test-stage] ${stage} failing-test-count=${failingCount}`);
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::notice title=${stage} failing-test-count::${failingCount}`);
  }

  if (timedOut) {
    console.error(`[ci:test-stage] ${stage} exceeded ${stageTimeoutMs}ms and was terminated.`);
    process.exit(1);
  }

  if (failingCount > 0) {
    process.exit(code && code !== 0 ? code : 1);
  }

  process.exit(code ?? (signal ? 1 : 0));
});
