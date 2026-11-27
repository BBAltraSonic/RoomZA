import { describe, expect, it } from "vitest";

import { maskNames, matchPerson, parseBusinessText } from "./request-intent";

const context = {
  people: [
    { key: "thandi:L1", name: "Thandi Mokoena" },
    { key: "sipho:L2", name: "Sipho Khumalo" },
    { key: "sipho2:L1", name: "Sipho Ndlovu" },
  ],
  listings: [
    { id: "L1", title: "Room in Bellville" },
    { id: "L2", title: "Flat in Rondebosch" },
  ],
};

const parse = (text: string) => parseBusinessText(text, context).request;

describe("parseBusinessText", () => {
  it("should_open_today_for_what_needs_attention", () => {
    expect(parse("What needs my attention today?")).toEqual({ template: "today" });
  });

  it("should_list_people_waiting_on_me", () => {
    expect(parse("who's waiting on me")).toEqual({ template: "people_list", filters: { waitingOnYou: true } });
  });

  it("should_list_this_weeks_enquiries", () => {
    expect(parse("How are my enquiries this week? Who's serious?")).toEqual({ template: "people_list", filters: { since: "week" } });
  });

  it("should_filter_interested_people_by_price", () => {
    expect(parse("Find everyone interested in rooms under R4,000")).toEqual({ template: "people_list", filters: { maxPrice: 4000 } });
  });

  it("should_filter_by_stage_and_listing", () => {
    expect(parse("who has gone quiet on Room in Bellville")).toEqual({ template: "people_list", filters: { stage: "gone-quiet", subjectId: "L1" } });
  });

  it("should_open_a_named_person_without_ai", () => {
    expect(parse("what about Thandi?")).toEqual({ template: "person_detail", personKey: "thandi:L1" });
    expect(parse("propose viewing times to Thandi Mokoena")).toEqual({ template: "viewing_slots", personKey: "thandi:L1" });
  });

  it("should_not_guess_between_two_people_with_the_same_first_name", () => {
    expect(matchPerson("what about Sipho", context.people)).toBeNull();
    expect(matchPerson("what about Sipho Ndlovu", context.people)?.key).toBe("sipho2:L1");
  });

  it("should_prepare_changes_for_approval", () => {
    expect(parse("accept all viewing requests")).toEqual({ template: "change_preview", change: { kind: "accept_viewings" } });
    expect(parse("archive people who've gone quiet")).toEqual({ template: "change_preview", change: { kind: "archive_quiet" } });
    expect(parse("Room in Bellville is now let")).toEqual({ template: "change_preview", change: { kind: "mark_let", listingId: "L1" } });
    expect(parse("raise prices by 5%")).toEqual({ template: "change_preview", change: { kind: "change_price", percent: 5 } });
    expect(parse("lower rent by 10% on Flat in Rondebosch")).toEqual({ template: "change_preview", change: { kind: "change_price", percent: -10, listingId: "L2" } });
    expect(parse("change the price of Flat in Rondebosch to R7,200")).toEqual({ template: "change_preview", change: { kind: "change_price", amount: 7200, listingId: "L2" } });
    expect(parse("decline Thandi")).toEqual({ template: "change_preview", change: { kind: "decline_viewing", personKey: "thandi:L1" } });
  });

  it("should_set_reminders", () => {
    expect(parse("remind me to call Thandi tomorrow")).toEqual({ template: "reminders", create: { text: "call Thandi", due: "tomorrow" } });
    expect(parse("Remind me to check the geyser next week")).toEqual({ template: "reminders", create: { text: "check the geyser", due: "next-week" } });
    expect(parse("my reminders")).toEqual({ template: "reminders" });
  });

  it("should_route_listing_work", () => {
    expect(parse("Help me list a two-bedroom apartment in Bellville")).toEqual({
      template: "new_listing",
      draft: { propertyType: "apartment", bedrooms: 2, area: "Bellville", notes: "Help me list a two-bedroom apartment in Bellville" },
    });
    expect(parse("what's missing on my listings")).toEqual({ template: "quality_check" });
    expect(parse("How are my listings doing?")).toEqual({ template: "performance" });
    expect(parse("what are people asking about")).toEqual({ template: "question_insights" });
  });

  it("should_hand_unplaced_words_to_the_ai_with_names_masked", () => {
    const result = parseBusinessText("Thandi Mokoena and the other one, sort it out", { people: [{ key: "thandi:L1", name: "Thandi Mokoena" }], listings: [] });
    // "Thandi" is a known name, so it's a person request handled locally.
    expect(result.request).toEqual({ template: "person_detail", personKey: "thandi:L1" });
    const vague = parseBusinessText("sort out the mess from the weekend", context);
    expect(vague).toEqual({ request: null, source: "rules", textForAi: "sort out the mess from the weekend" });
  });
});

describe("maskNames", () => {
  it("should_replace_full_and_first_names", () => {
    expect(maskNames("Did Thandi Mokoena or sipho reply?", context.people)).toBe("Did [person] or [person] reply?");
  });
});

describe("parseBusinessText: improving a description", () => {
  const listings = [{ id: "11111111-1111-4111-8111-111111111111", title: "Room in Bellville" }];

  it("should_offer_a_new_description_for_a_named_listing", () => {
    expect(parseBusinessText("rewrite the description of my Room in Bellville", { people: [], listings }).request).toEqual({ template: "improve_listing", listingId: listings[0]!.id });
  });

  it("should_show_the_quality_check_when_no_listing_is_named", () => {
    expect(parseBusinessText("can you write a better description", { people: [], listings }).request).toEqual({ template: "quality_check" });
  });
});
