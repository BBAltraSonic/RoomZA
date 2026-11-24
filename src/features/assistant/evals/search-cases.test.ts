import { describe, expect, it } from "vitest";

import { chipId, GAP_KEYS, parseSearchText, type SearchChip } from "../search-intent";
import { SEARCH_CASES } from "./search-cases";
import { chipsFromIds } from "./score";

describe("AI job 1 test set", () => {
  it("should_hold_about_50_examples", () => {
    expect(SEARCH_CASES.length).toBeGreaterThanOrEqual(50);
  });

  it("should_only_name_chips_and_gaps_pinpoint_has", () => {
    for (const example of SEARCH_CASES) {
      expect(chipsFromIds(example.chips).map(chipId).sort(), example.text).toEqual([...example.chips].sort());
      for (const gap of example.gaps ?? []) expect(GAP_KEYS, example.text).toContain(gap);
    }
  });

  it.each(SEARCH_CASES.filter((example) => example.rules).map((example) => [example.text, example] as const))(
    "rules_should_understand_%s_without_ai",
    (_text, example) => {
      const parsed = parseSearchText(example.text, chipsFromIds(example.current ?? []) as SearchChip[]);
      if (example.notEnglish) {
        expect(parsed.notEnglish).toBe(true);
        return;
      }
      expect(parsed.chips.map(chipId).sort()).toEqual([...example.chips].sort());
      expect(parsed.gaps.map((gap) => gap.key).sort()).toEqual([...(example.gaps ?? [])].sort());
      expect(parsed.needsAi).toBe(false);
    },
  );
});
