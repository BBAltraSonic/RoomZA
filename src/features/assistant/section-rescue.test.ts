import { describe, expect, it } from "vitest";

import { pickSectionRescue, sectionRescueCandidates } from "./section-rescue";

describe("sectionRescueCandidates", () => {
  it("should_offer_dropping_each_quick_filter_then_the_words", () => {
    const candidates = sectionRescueCandidates({ quick: ["tonight", "free"], nearest: true, text: "jazz" });
    expect(candidates.map((candidate) => candidate.without)).toEqual(["Tonight", "Free", "“jazz”"]);
    expect(candidates[0]!.next).toEqual({ quick: ["free"], nearest: true, text: "jazz" });
    expect(candidates[2]!.next).toEqual({ quick: ["tonight", "free"], nearest: true, text: "" });
  });

  it("should_not_offer_dropping_the_nearest_sort_because_it_does_not_change_the_count", () => {
    expect(sectionRescueCandidates({ quick: [], nearest: true, text: "" })).toEqual([]);
  });
});

describe("pickSectionRescue", () => {
  const candidates = sectionRescueCandidates({ quick: ["tonight", "free"], nearest: false, text: "jazz" });

  it("should_pick_the_change_that_finds_the_most", () => {
    expect(pickSectionRescue(candidates, [2, 5, 1])).toEqual({ ...candidates[1], count: 5 });
  });

  it("should_prefer_the_earlier_change_on_a_tie", () => {
    expect(pickSectionRescue(candidates, [3, 3, 3])?.without).toBe("Tonight");
  });

  it("should_skip_changes_that_could_not_be_counted_or_find_nothing", () => {
    expect(pickSectionRescue(candidates, [null, 0, null])).toBeNull();
    expect(pickSectionRescue(candidates, [null, 0, 4])?.without).toBe("“jazz”");
  });
});
