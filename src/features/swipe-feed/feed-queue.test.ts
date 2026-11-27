import { describe, expect, it } from "vitest";

import { createFeedState, currentId, feedPosition, feedReducer, upcomingIds, visibleIds, type FeedState } from "./feed-queue";

const ids = ["a", "b", "c", "d"];
const start = (overrides: Parameters<typeof createFeedState>[1] = {}) => createFeedState(ids, overrides);
const run = (state: FeedState, ...events: Parameters<typeof feedReducer>[1][]) => events.reduce(feedReducer, state);

describe("createFeedState", () => {
  it("should_start_at_the_first_listing", () => {
    expect(currentId(start())).toBe("a");
  });

  it("should_skip_listings_passed_earlier_this_session", () => {
    const state = start({ passed: ["a", "c"] });
    expect(currentId(state)).toBe("b");
    expect(visibleIds(state)).toEqual(["b", "d"]);
  });

  it("should_open_at_a_requested_listing", () => {
    expect(currentId(start({ cursor: "c" }))).toBe("c");
  });

  it("should_have_no_current_listing_when_there_are_no_results", () => {
    expect(currentId(createFeedState([]))).toBeNull();
  });
});

describe("pass and save", () => {
  it("should_move_to_the_next_listing_after_a_pass", () => {
    const state = run(start(), { type: "pass", id: "a" });
    expect(currentId(state)).toBe("b");
    expect(visibleIds(state)).toEqual(["b", "c", "d"]);
  });

  it("should_move_to_the_next_listing_after_a_save_and_keep_the_saved_one_visible", () => {
    const state = run(start(), { type: "save", id: "a" });
    expect(currentId(state)).toBe("b");
    expect(visibleIds(state)).toContain("a");
  });

  it("should_skip_passed_listings_when_moving_forward", () => {
    const state = run(start({ passed: ["b"] }), { type: "save", id: "a" });
    expect(currentId(state)).toBe("c");
  });

  it("should_reach_the_end_after_the_last_listing", () => {
    const state = run(start({ cursor: "d" }), { type: "pass", id: "d" });
    expect(currentId(state)).toBeNull();
  });

  it("should_ignore_an_action_on_a_listing_that_is_not_in_the_results", () => {
    const before = start();
    expect(feedReducer(before, { type: "pass", id: "zzz" })).toBe(before);
  });
});

describe("undo", () => {
  it("should_bring_back_the_last_passed_listing", () => {
    const state = run(start(), { type: "pass", id: "a" }, { type: "undo" });
    expect(currentId(state)).toBe("a");
    expect(state.passed.has("a")).toBe(false);
    expect(state.history).toEqual([]);
  });

  it("should_return_to_the_last_saved_listing", () => {
    const state = run(start(), { type: "save", id: "a" }, { type: "save", id: "b" }, { type: "undo" });
    expect(currentId(state)).toBe("b");
    expect(state.history).toEqual([{ type: "save", id: "a" }]);
  });

  it("should_undo_from_the_end_of_the_feed", () => {
    const state = run(start({ cursor: "d" }), { type: "pass", id: "d" }, { type: "undo" });
    expect(currentId(state)).toBe("d");
  });

  it("should_do_nothing_when_there_is_nothing_to_undo", () => {
    const before = start();
    expect(feedReducer(before, { type: "undo" })).toBe(before);
  });

  it("should_keep_only_the_most_recent_twenty_actions", () => {
    const many = Array.from({ length: 30 }, (_, index) => `id-${index}`);
    let state = createFeedState(many);
    for (const id of many) state = feedReducer(state, { type: "save", id });
    expect(state.history).toHaveLength(20);
    expect(state.history[0]).toEqual({ type: "save", id: "id-10" });
  });
});

describe("results change", () => {
  it("should_keep_the_current_listing_when_it_is_still_in_the_results", () => {
    const state = run(start({ cursor: "c" }), { type: "results", order: ["x", "c", "y"] });
    expect(currentId(state)).toBe("c");
  });

  it("should_restart_at_the_first_match_when_the_current_listing_is_gone", () => {
    const state = run(start({ cursor: "c" }), { type: "results", order: ["x", "y"] });
    expect(currentId(state)).toBe("x");
  });

  it("should_keep_session_passes_hidden_after_a_chip_change", () => {
    const state = run(start(), { type: "pass", id: "a" }, { type: "results", order: ["a", "x"] });
    expect(currentId(state)).toBe("x");
  });

  it("should_leave_the_end_state_when_new_results_arrive", () => {
    const state = run(start({ cursor: "d" }), { type: "pass", id: "d" }, { type: "results", order: ["x"] });
    expect(currentId(state)).toBe("x");
  });

  it("should_drop_undo_history_for_listings_no_longer_in_the_results", () => {
    const state = run(start(), { type: "save", id: "a" }, { type: "save", id: "b" }, { type: "results", order: ["b", "c"] });
    expect(state.history).toEqual([{ type: "save", id: "b" }]);
  });
});

describe("open", () => {
  it("should_jump_to_a_listing_in_the_results", () => {
    expect(currentId(run(start(), { type: "open", id: "c" }))).toBe("c");
  });

  it("should_put_a_listing_outside_the_results_first", () => {
    const state = run(start(), { type: "open", id: "deep-link" });
    expect(currentId(state)).toBe("deep-link");
    expect(visibleIds(state)[0]).toBe("deep-link");
  });

  it("should_show_a_passed_listing_again_when_it_is_opened_on_purpose", () => {
    const state = run(start(), { type: "pass", id: "a" }, { type: "open", id: "a" });
    expect(currentId(state)).toBe("a");
    expect(state.passed.has("a")).toBe(false);
  });
});

describe("restorePassed", () => {
  it("should_show_passed_listings_again_from_the_start", () => {
    const state = run(start(), { type: "pass", id: "a" }, { type: "pass", id: "b" }, { type: "restorePassed" });
    expect(currentId(state)).toBe("a");
    expect(state.passed.size).toBe(0);
  });
});

describe("passes", () => {
  it("should_hide_session_passes_read_after_the_first_render", () => {
    const state = run(start(), { type: "passes", ids: ["b", "c"] });
    expect(visibleIds(state)).toEqual(["a", "d"]);
    expect(currentId(state)).toBe("a");
  });

  it("should_keep_the_listing_on_screen_even_if_it_was_passed_before", () => {
    const state = run(start({ cursor: "b" }), { type: "passes", ids: ["b"] });
    expect(currentId(state)).toBe("b");
    expect(state.passed.has("b")).toBe(false);
  });
});

describe("helpers", () => {
  it("should_list_the_next_listings_for_prefetching", () => {
    expect(upcomingIds(start({ passed: ["b"] }), 2)).toEqual(["c", "d"]);
  });

  it("should_report_the_position_among_visible_listings", () => {
    expect(feedPosition(run(start(), { type: "pass", id: "a" }))).toEqual({ index: 1, total: 3 });
    expect(feedPosition(createFeedState([]))).toEqual({ index: 0, total: 0 });
  });
});
