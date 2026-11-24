import { describe, expect, it } from "vitest";

import { aiResultToRequest, type AiListerResult } from "./ai-lister";
import { checkAiWriting, featuresFromNotes, numbersIn, writeListingByRules } from "./listing-writer";

const input = { propertyType: "apartment", bedrooms: 2, price: 8500, area: "Bellville", notes: "2 bed apartment in Bellville, R8500, fibre, secure parking and a balcony" };

describe("writeListingByRules", () => {
  it("should_write_a_plain_title_and_description_from_the_fields", () => {
    expect(writeListingByRules(input)).toEqual({
      title: "2-bedroom apartment in Bellville",
      description: "A 2-bedroom apartment in Bellville to rent. R8,500 a month. Features: WiFi, Secure Parking, Balcony.",
      features: ["wifi", "secure_parking", "balcony"],
      propertyType: "apartment",
    });
  });

  it("should_find_features_only_when_typed", () => {
    expect(featuresFromNotes("lovely sunny room")).toEqual([]);
  });
});

describe("numbersIn", () => {
  it("should_read_thousands_groups_as_one_number_and_spaced_digits_as_several", () => {
    expect(numbersIn("R14,500 or R14 500, 3 2, R3.5k, 2,450,000")).toEqual(["14500", "14500", "3", "2", "3.5", "2450000"]);
  });
});

describe("checkAiWriting", () => {
  it("should_accept_writing_that_only_uses_given_facts", () => {
    const checked = checkAiWriting({ title: "Bright 2-bed apartment in Bellville", description: "A bright 2-bedroom apartment with fibre and secure parking, R8500 a month.", features: ["wifi", "secure_parking", "bogus"], propertyType: "apartment" }, input);
    expect(checked).toEqual({ title: "Bright 2-bed apartment in Bellville", description: "A bright 2-bedroom apartment with fibre and secure parking, R8500 a month.", features: ["wifi", "secure_parking"], propertyType: "apartment" });
  });

  it("should_reject_writing_with_a_number_the_lister_never_gave", () => {
    expect(checkAiWriting({ title: "2-bed apartment in Bellville", description: "Only 5 minutes from the station, 80 square metres.", features: [], propertyType: null }, input)).toBeNull();
  });

  it("should_not_merge_separate_field_numbers_into_one", () => {
    const house = { propertyType: "house", bedrooms: 3, bathrooms: 2, price: 14500, area: "Durbanville", notes: "family house with a big garden" };
    expect(checkAiWriting({ title: "3-bedroom house in Durbanville", description: "A 3-bedroom house. 2 bathrooms. R14,500 a month.", features: [], propertyType: "house" }, house)).not.toBeNull();
  });

  it("should_drop_an_unknown_property_type", () => {
    expect(checkAiWriting({ title: "Lovely place in Bellville", description: "A lovely place with a balcony and fibre.", features: [], propertyType: "castle" }, input)!.propertyType).toBeNull();
  });
});

describe("aiResultToRequest (job 2 checks)", () => {
  const empty: AiListerResult = { template: "today", stage: null, waitingOnYou: false, since: null, maxPrice: null, minPrice: null, change: null, percent: null, amount: null, reminderText: null, reminderDue: null };

  it("should_keep_valid_people_filters", () => {
    expect(aiResultToRequest({ ...empty, template: "people_list", stage: "gone-quiet", since: "week", maxPrice: 4000 }, "x")).toEqual({
      template: "people_list",
      filters: { stage: "gone-quiet", since: "week", maxPrice: 4000 },
    });
  });

  it("should_refuse_a_change_without_a_kind_or_an_extreme_price_change", () => {
    expect(aiResultToRequest({ ...empty, template: "change_preview" }, "x")).toEqual({ template: "today" });
    expect(aiResultToRequest({ ...empty, template: "change_preview", change: "change_price", percent: 90 }, "x")).toEqual({ template: "performance" });
    expect(aiResultToRequest({ ...empty, template: "change_preview", change: "change_price", percent: -5 }, "x")).toEqual({ template: "change_preview", change: { kind: "change_price", percent: -5 } });
  });

  it("should_keep_reminder_text_short", () => {
    expect(aiResultToRequest({ ...empty, template: "reminders", reminderText: "  call the plumber  ", reminderDue: "friday" }, "x")).toEqual({ template: "reminders", create: { text: "call the plumber", due: "friday" } });
  });
});
