/**
 * Runs an AI job's test set against real models (proposal, "Choosing models").
 *
 *   npm run assistant:eval -- --job search
 *   npm run assistant:eval -- --job search --models nvidia/nemotron-3.5-super-vl:free,another/model:free
 *   npm run assistant:eval -- --job lister --limit 10
 *
 * Needs OPENROUTER_API_KEY in .env.local. Test sets hold made-up requests only. Each model is
 * scored on its own (no fallbacks), so the numbers say which model to pin first.
 */

import { runEval, EVAL_JOBS, type EvalJobName } from "../../src/features/assistant/evals/run";

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const job = (arg("--job") ?? "search") as EvalJobName;
  if (!(job in EVAL_JOBS)) throw new Error(`Unknown job "${job}". Jobs: ${Object.keys(EVAL_JOBS).join(", ")}`);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("Set OPENROUTER_API_KEY in .env.local to run a test set against a model.");
  const models = (arg("--models") ?? process.env.ASSISTANT_AI_MODELS ?? "nvidia/nemotron-3.5-super-vl:free")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const limit = Number(arg("--limit") ?? Infinity);
  const dataCollection = process.env.OPENROUTER_DATA_COLLECTION === "allow" ? "allow" : "deny";

  for (const model of models) {
    const report = await runEval(job, { apiKey, models: [model], dataCollection }, { limit, onCase: (line) => process.stdout.write(`${line}\n`) });
    process.stdout.write(`\n${model}: ${report.passed}/${report.total} exact (${Math.round((report.passed / Math.max(1, report.total)) * 100)}%), ${report.unavailable} unavailable\n\n`);
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Eval failed."}\n`);
  process.exitCode = 1;
});
