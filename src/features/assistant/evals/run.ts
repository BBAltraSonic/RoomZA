import { combineRulesAndAi, interpretSearchWithAi, type AssistantAiConfig } from "../ai-search";
import { aiResultToRequest, routeListerRequestWithAi } from "../business/ai-lister";
import { writeListingWithAi } from "../business/ai-listing-writer";
import { parseBusinessText, type BusinessRequest } from "../business/request-intent";
import { parseSearchText } from "../search-intent";
import { LISTER_CASES } from "./lister-cases";
import { SEARCH_CASES } from "./search-cases";
import { chipsFromIds, scoreCase } from "./score";
import { scoreListerCase, scoreWritingCase } from "./score-business";
import { WRITING_CASES } from "./writing-cases";

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

async function runListerCase(index: number, config: AssistantAiConfig): Promise<CaseResult> {
  const example = LISTER_CASES[index]!;
  // Like production: rules first, the AI only for what they can't place. Names are already "[person]".
  const rules = parseBusinessText(example.text, { people: [], listings: [] });
  let request: BusinessRequest | null = rules.request;
  let unavailable = false;
  if (rules.request === null) {
    const outcome = await routeListerRequestWithAi(rules.textForAi, config);
    if (outcome.ok) request = aiResultToRequest(outcome.result, rules.textForAi);
    else unavailable = true;
  }
  if (!request) return { passed: false, unavailable, line: `N/A   ${example.text}  (AI unavailable)` };
  const score = scoreListerCase(example, request);
  const source = rules.request ? "rules" : "ai";
  return { passed: score.exact, unavailable, line: `${score.exact ? "PASS" : "FAIL"}  ${example.text}  [${source}]${score.exact ? "" : `  ${score.wrong.join("; ")}`}` };
}

async function runWritingCase(index: number, config: AssistantAiConfig): Promise<CaseResult> {
  const example = WRITING_CASES[index]!;
  const label = example.input.notes.slice(0, 70);
  const outcome = await writeListingWithAi(example.input, config);
  if (!outcome.ok) {
    // A rejected answer invented a fact or broke the format: a real failure, not an outage.
    return { passed: false, unavailable: outcome.reason === "unavailable", line: `${outcome.reason === "unavailable" ? "N/A " : "FAIL"}  ${label}  (${outcome.reason})` };
  }
  const score = scoreWritingCase(example, outcome.writing);
  const detail = score.exact ? "" : `  type ${score.typeRight ? "ok" : `${outcome.writing.propertyType} (expected ${example.propertyType})`} missing [${score.missing.join(", ")}] extra [${score.extra.join(", ")}]`;
  return { passed: score.exact, unavailable: false, line: `${score.exact ? "PASS" : "FAIL"}  ${label}${detail}` };
}

export const EVAL_JOBS = {
  search: { cases: SEARCH_CASES.length, run: runSearchCase },
  lister: { cases: LISTER_CASES.length, run: runListerCase },
  writing: { cases: WRITING_CASES.length, run: runWritingCase },
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
