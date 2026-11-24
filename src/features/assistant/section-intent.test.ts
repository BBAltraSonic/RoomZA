import { describe, expect, it } from "vitest";

import { applySectionSearch, parseSectionText, readSectionSearch, SECTION_STARTERS } from "./section-intent";

describe("parseSectionText", () => {
  it("should_read_a_service_type_and_open_now", () => {
    expect(parseSectionText("plumber open now", "service")).toEqual({ serviceType: "Plumbing", quick: ["open-now"], nearest: false, text: "" });
  });

  it("should_read_cheap_services_as_below_nearby_price", () => {
    expect(parseSectionText("cheap cleaner near me", "service")).toEqual({ serviceType: "Cleaning", quick: ["below-nearby"], nearest: true, text: "" });
  });

  it("should_read_event_times_and_free", () => {
    expect(parseSectionText("free live music tonight", "event")).toEqual({ quick: ["tonight", "free"], nearest: false, text: "live music" });
    expect(parseSectionText("what's on this weekend", "event").quick).toEqual(["this-weekend"]);
    expect(parseSectionText("anything happening now", "event").quick).toEqual(["on-now"]);
  });

  it("should_read_specials_ending_today_and_new", () => {
    expect(parseSectionText("food deals ending today", "shopping")).toEqual({ quick: ["ending-today"], nearest: false, text: "food" });
    expect(parseSectionText("new specials", "shopping").quick).toEqual(["new-this-week"]);
  });

  it("should_ignore_filters_the_section_does_not_have", () => {
    expect(parseSectionText("free tonight", "shopping")).toEqual({ quick: [], nearest: false, text: "" });
  });

  it("should_keep_the_rest_as_search_words", () => {
    expect(parseSectionText("pizza", "shopping").text).toBe("pizza");
  });
});

describe("applySectionSearch", () => {
  it("should_write_the_search_into_the_address_and_keep_the_map", () => {
    const next = applySectionSearch(new URLSearchParams("bbox=1,2,3,4&view=map&detailId=x"), { serviceType: "Plumbing", quick: ["open-now"], nearest: true, text: "geyser" });
    expect(next.get("bbox")).toBe("1,2,3,4");
    expect(next.get("serviceType")).toBe("Plumbing");
    expect(next.get("quick")).toBe("open-now");
    expect(next.get("sort")).toBe("Nearest");
    expect(next.get("q")).toBe("geyser");
    expect(next.has("detailId")).toBe(false);
  });

  it("should_clear_what_the_new_search_leaves_out", () => {
    const next = applySectionSearch(new URLSearchParams("q=old&quick=free&sort=Nearest"), { quick: [], nearest: false, text: "" });
    expect(next.toString()).toBe("");
  });
});

describe("readSectionSearch", () => {
  it("should_read_the_current_search_back_from_the_address", () => {
    expect(readSectionSearch(new URLSearchParams("q=pizza&quick=ending-today,bogus&sort=Nearest"), "shopping")).toEqual({ quick: ["ending-today"], nearest: true, text: "pizza" });
    expect(readSectionSearch(new URLSearchParams("serviceType=Cleaning"), "service")).toEqual({ serviceType: "Cleaning", quick: [], nearest: false, text: "" });
  });
});

describe("starters", () => {
  it("should_have_the_proposal_starters_per_section", () => {
    expect(SECTION_STARTERS.shopping.map((starter) => starter.label)).toEqual(["Food deals near me", "Ending today", "New this week"]);
    expect(SECTION_STARTERS.service.map((starter) => starter.label)).toEqual(["Plumber", "Cleaner", "Open now"]);
    expect(SECTION_STARTERS.event.map((starter) => starter.label)).toEqual(["Tonight", "This weekend", "Free"]);
  });
});
