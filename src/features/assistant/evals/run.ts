import { combineRulesAndAi, interpretSearchWithAi, type AssistantAiConfig } from "../ai-search";
import { parseSearchText } from "../search-intent";
import { SEARCH_CASES } from "./search-cases";
import { chipsFromIds, scoreCase } from "./score";

/**
 * The test-set runner behind `npm run assistant:eval`. One entry per AI job. Each job runs a
 * case through the same code production uses and reports an exact-match score.
 */

export type CaseResult = { passed: boolean; unavailable: boolean; line: string };

type EvalJob = { cases: number; run: (index: number, config: AssistantAiConfig) => Promise<CaseResult> };

async function runSearchCase(index: number, config: AssistantAiConfig): Promise<CaseResult> {
  const example = SEARCH_CASES[index]!;
  const current = chipsFromIds(example.current ?? []);
  const rules = parseSearchText(example.text, current);
  let chips = rules.chips;
  let gaps = rules.gaps.map((gap) => gap.key as string);
  let notEnglish = rules.notEnglish;
  let unavailable = false;
  // Like production: the AI is only asked when the rules leave words they can't place.
  if (!rules.notEnglish && rules.needsAi) {
    const outcome = await interpretSearchWithAi({ text: example.text, currentChipLabels: [] }, config);
    if (outcome.ok) {
      const combined = combineRulesAndAi(example.text, current, outcome.result);
      chips = combined.chips;
      gaps = combined.gaps.map((gap) => gap.key);
      notEnglish = combined.notEnglish;
    } else {
      unavailable = true;
    }
  }
  if (example.notEnglish) {
    return { passed: notEnglish, unavailable, line: `${notEnglish ? "PASS" : "FAIL"}  ${example.text}  (expected: not English)` };
  }
  const score = scoreCase(example, { chips, gaps });
  const detail = score.exact ? "" : `  missing [${score.missing.join(", ")}] extra [${score.extra.join(", ")}]`;
  return { passed: score.exact, unavailable, line: `${score.exact ? "PASS" : unavailable ? "N/A " : "FAIL"}  ${example.text}${detail}` };
}

export const EVAL_JOBS = {
  search: { cases: SEARCH_CASES.length, run: runSearchCase },
} satisfies Record<string, EvalJob>;

export type EvalJobName = keyof typeof EVAL_JOBS;

export async function runEval(job: EvalJobName, config: AssistantAiConfig, options: { limit?: number; onCase?: (line: string) => void } = {}) {
  const definition: EvalJob = EVAL_JOBS[job];
  const total = Math.min(definition.cases, Number.isFinite(options.limit) ? options.limit! : definition.cases);
  let passed = 0;
  let unavailable = 0;
  for (let index = 0; index < total; index += 1) {
    const result = await definition.run(index, config);
    if (result.passed) passed += 1;
    if (result.unavailable) unavailable += 1;
    options.onCase?.(result.line);
  }
  return { total, passed, unavailable };
}
