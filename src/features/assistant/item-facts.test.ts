import { describe, expect, it } from "vitest";

import { ITEM_QUESTIONS, answerItemFact, isItemQuestion, itemSummary, matchItemTopic, type PikoItem } from "./item-facts";

// 10:00 on 24 November 2026 in Johannesburg.
const NOW = new Date("2026-11-24T08:00:00Z");

const special: PikoItem = {
  kind: "special",
  id: "s1",
  title: "Two burgers for one",
  by: "Mzansi Grill",
  address: "12 Main Road, Rondebosch",
  startsAt: "2026-11-20T08:00:00Z",
  endsAt: "2026-11-24T15:00:00Z",
  priceCents: 8900,
  originalPriceCents: 17800,
  conditions: "Dine-in only. Not valid with other specials.",
};

const event: PikoItem = {
  kind: "event",
  id: "e1",
  title: "Jazz on the lawn",
  by: "Kirstenbosch",
  address: "Rhodes Drive, Newlands",
  startsAt: "2026-11-28T15:00:00Z",
  endsAt: "2026-11-28T19:00:00Z",
  priceCents: 0,
};

describe("item facts", () => {
  it("should_offer_preset_questions_that_fit_each_kind_of_item", () => {
    expect(ITEM_QUESTIONS.special.map((q) => q.label)).toEqual(["How much is it?", "When does it end?", "Where is it?", "Any conditions?"]);
    expect(ITEM_QUESTIONS.event.map((q) => q.label)).toEqual(["When is it?", "How much is it?", "Where is it?"]);
  });

  it("should_match_typed_questions_to_a_topic", () => {
    expect(matchItemTopic("how much is this?")).toBe("price");
    expect(matchItemTopic("is it still on tomorrow")).toBe("ends");
    expect(matchItemTopic("what time does it start")).toBe("when");
    expect(matchItemTopic("where is the shop")).toBe("where");
    expect(matchItemTopic("any catch / t&cs?")).toBe("conditions");
    expect(matchItemTopic("pizza near me")).toBeNull();
  });

  it("should_treat_questions_as_questions_and_anything_else_as_a_search", () => {
    expect(isItemQuestion("When does it end?")).toBe(true);
    expect(isItemQuestion("how much")).toBe(true);
    expect(isItemQuestion("cheap pizza")).toBe(false);
  });

  it("should_answer_price_with_the_discount_from_the_special_itself", () => {
    expect(answerItemFact(special, "price", NOW)).toEqual({ known: true, answer: "R89, down from R178 (50% off)." });
    expect(answerItemFact(event, "price", NOW)).toEqual({ known: true, answer: "It's free." });
  });

  it("should_say_when_a_special_ends_in_plain_words", () => {
    expect(answerItemFact(special, "ends", NOW)).toEqual({ known: true, answer: "It ends today at 17:00." });
    expect(answerItemFact({ ...special, endsAt: "2026-11-25T15:00:00Z" }, "ends", NOW)).toEqual({ known: true, answer: "It ends tomorrow at 17:00." });
    expect(answerItemFact({ ...special, endsAt: "2026-12-03T15:00:00Z" }, "ends", NOW)).toEqual({ known: true, answer: "It ends on 3 December at 17:00." });
    expect(answerItemFact({ ...special, endsAt: "2026-11-24T07:00:00Z" }, "ends", NOW)).toEqual({ known: true, answer: "It has ended." });
  });

  it("should_say_when_an_event_starts_or_that_it_is_on_now", () => {
    expect(answerItemFact(event, "when", NOW)).toEqual({ known: true, answer: "It starts on 28 November at 17:00 and ends at 21:00." });
    expect(answerItemFact(special, "when", NOW)).toEqual({ known: true, answer: "It's on now, until today at 17:00." });
  });

  it("should_answer_where_and_conditions_from_the_item", () => {
    expect(answerItemFact(special, "where", NOW)).toEqual({ known: true, answer: "Mzansi Grill, 12 Main Road, Rondebosch." });
    expect(answerItemFact(special, "conditions", NOW)).toEqual({ known: true, answer: "Dine-in only. Not valid with other specials." });
  });

  it("should_never_guess_what_the_item_does_not_say", () => {
    expect(answerItemFact({ ...special, priceCents: undefined, originalPriceCents: undefined }, "price", NOW)).toEqual({ known: false });
    expect(answerItemFact(event, "conditions", NOW)).toEqual({ known: false });
  });

  it("should_keep_long_conditions_short", () => {
    const answer = answerItemFact({ ...special, conditions: "x".repeat(1000) }, "conditions", NOW);
    expect(answer.known && answer.answer.length).toBeLessThanOrEqual(400);
    expect(answer.known && answer.answer.endsWith("…")).toBe(true);
  });
});

describe("item summary on a result card", () => {
  it("should_give_a_special's_price_discount_and_end", () => {
    expect(itemSummary(special, NOW)).toBe("R89, 50% off · Ends today at 17:00");
  });

  it("should_say_free_and_when_a_future_event_starts", () => {
    expect(itemSummary({ ...event, startsAt: "2026-11-25T17:00:00Z", endsAt: "2026-11-25T20:00:00Z" }, NOW)).toBe("Free · Starts tomorrow at 19:00");
  });

  it("should_say_when_an_item_has_ended", () => {
    expect(itemSummary({ ...special, endsAt: "2026-11-24T07:00:00Z" }, NOW)).toBe("R89, 50% off · Ended");
  });

  it("should_leave_out_a_price_the_item_does_not_give", () => {
    expect(itemSummary({ ...special, priceCents: undefined }, NOW)).toBe("Ends today at 17:00");
  });

});
