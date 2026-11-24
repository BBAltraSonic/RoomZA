import { afterEach, describe, expect, it, vi } from "vitest";

import { LISTER_CASES } from "./lister-cases";
import { runEval } from "./run";
import { WRITING_CASES } from "./writing-cases";

const CONFIG = { apiKey: "test", models: ["test/model"], dataCollection: "deny" as const };

function modelAnswers(answer: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runEval", () => {
  it("should_score_lister_requests_the_rules_place_without_asking_the_model", async () => {
    const fetchMock = modelAnswers({});
    const lines: string[] = [];
    const report = await runEval("lister", CONFIG, { limit: 3, onCase: (line) => lines.push(line) });
    expect(LISTER_CASES.slice(0, 3).every((example) => example.rules)).toBe(true);
    expect(report).toEqual({ total: 3, passed: 3, unavailable: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lines[0]).toMatch(/^PASS .*\[rules\]$/);
  });

  it("should_ask_the_model_for_what_the_rules_cannot_place_and_check_its_answer", async () => {
    const index = LISTER_CASES.findIndex((example) => !example.rules && example.template === "today");
    const fetchMock = modelAnswers({ template: "today", stage: null, waitingOnYou: false, since: null, maxPrice: null, minPrice: null, change: null, percent: null, amount: null, reminderText: null, reminderDue: null });
    const lines: string[] = [];
    const report = await runEval("lister", CONFIG, { limit: index + 1, onCase: (line) => lines.push(line) });
    expect(fetchMock).toHaveBeenCalled();
    expect(lines[index]).toMatch(/^PASS .*\[ai\]$/);
    expect(report.unavailable).toBe(0);
  });

  it("should_fail_writing_that_invents_a_number_and_pass_writing_that_does_not", async () => {
    const example = WRITING_CASES[0]!;
    modelAnswers({ title: "Bright apartment in Bellville", description: "A bright apartment with fibre, secure parking and a balcony, only 5 minutes from the station.", features: example.features, propertyType: example.propertyType });
    const invented = await runEval("writing", CONFIG, { limit: 1 });
    expect(invented).toEqual({ total: 1, passed: 0, unavailable: 0 });

    modelAnswers({ title: "Bright apartment in Bellville", description: "A bright apartment with fibre, secure parking and a balcony.", features: example.features, propertyType: example.propertyType });
    expect(await runEval("writing", CONFIG, { limit: 1 })).toEqual({ total: 1, passed: 1, unavailable: 0 });
  });

  it("should_count_an_unreachable_model_as_unavailable_not_failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("busy", { status: 503 })));
    const lines: string[] = [];
    expect(await runEval("writing", CONFIG, { limit: 1, onCase: (line) => lines.push(line) })).toEqual({ total: 1, passed: 0, unavailable: 1 });
    expect(lines[0]).toMatch(/^N\/A .*\(unavailable\)$/);
  });
});
