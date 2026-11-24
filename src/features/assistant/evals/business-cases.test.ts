import { describe, expect, it } from "vitest";

import { checkAiWriting, writeListingByRules } from "../business/listing-writer";
import { parseBusinessText } from "../business/request-intent";
import { LISTER_CASES } from "./lister-cases";
import { requestFields } from "./score-business";
import { WRITING_CASES } from "./writing-cases";

describe("AI job 2 test set", () => {
  it("should_hold_about_50_examples", () => {
    expect(LISTER_CASES.length).toBeGreaterThanOrEqual(50);
  });

  it.each(LISTER_CASES.filter((example) => example.rules).map((example) => [example.text, example] as const))("rules_should_place_%s", (_text, example) => {
    const result = parseBusinessText(example.text, { people: [], listings: [] });
    expect(result.request?.template).toBe(example.template);
    const fields = requestFields(result.request!);
    for (const [key, value] of Object.entries(example.expect ?? {})) expect(fields[key], key).toBe(value);
  });
});

describe("AI job 3 test set", () => {
  it("should_hold_about_50_examples", () => {
    expect(WRITING_CASES.length).toBeGreaterThanOrEqual(50);
  });

  it("should_always_have_a_rules_version_that_passes_the_checks", () => {
    for (const example of WRITING_CASES) {
      const rules = writeListingByRules(example.input);
      expect(rules.title.length, example.input.notes).toBeGreaterThan(3);
      // The rules version only repeats given facts, so the same check must accept it.
      expect(checkAiWriting(rules, example.input), example.input.notes).not.toBeNull();
    }
  });
});
