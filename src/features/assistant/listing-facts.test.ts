import { describe, expect, it } from "vitest";

import { answerListingFact, isListingQuestion, matchFactTopic, type FactListing } from "./listing-facts";

const listing: FactListing = {
  id: "l1",
  title: "Sunny room",
  listing_type: "rent",
  price: 3800,
  display_price: 3800,
  bedrooms: 1,
  bathrooms: 1,
  parking_type: "covered",
  parking_count: 1,
  parking_included: true,
  parking_estimate: null,
  electricity_type: "prepaid",
  electricity_included: false,
  electricity_estimate: 400,
  water_availability: "municipal",
  water_included: true,
  water_estimate: null,
  wifi_available: true,
  wifi_included: false,
  wifi_estimate: 300,
  deposit_amount: 3800,
  deposit_online: true,
  admin_fee: null,
  lease_duration: "12_months",
  availability_date: "2026-12-01",
  metadata: { amenities: { essentials: ["furnished", "backup_power"], security: ["cctv", "gated_complex"], lifestyle: ["laundry"], appliances: [] } },
};

describe("matchFactTopic", () => {
  it.each([
    ["Does it have parking?", "parking"],
    ["is there a garage", "parking"],
    ["Are pets allowed?", "pets"],
    ["can I bring my dog", "pets"],
    ["Is wifi included?", "wifi"],
    ["how much is the deposit", "deposit"],
    ["is electricity included", "electricity"],
    ["prepaid lights?", "electricity"],
    ["what about water", "water"],
    ["is it furnished", "furnished"],
    ["when can I move in", "move-in"],
    ["how long is the lease", "lease"],
    ["is it safe? security?", "security"],
    ["what happens during load shedding", "backup-power"],
    ["is there a washing machine", "laundry"],
    ["any admin fee?", "fees"],
    ["how many bedrooms", "bedrooms"],
    ["how many bathrooms", "bathrooms"],
    ["what's the rent", "price"],
  ])("should_read_%s_as_%s", (question, topic) => {
    expect(matchFactTopic(question)).toBe(topic);
  });

  it("should_return_null_for_a_question_it_cannot_place", () => {
    expect(matchFactTopic("what colour are the walls")).toBeNull();
  });
});

describe("isListingQuestion", () => {
  it("should_treat_a_question_about_a_known_topic_as_a_listing_question", () => {
    expect(isListingQuestion("Does it have parking?")).toBe(true);
    expect(isListingQuestion("is wifi included")).toBe(true);
  });

  it("should_treat_a_search_as_a_search", () => {
    expect(isListingQuestion("furnished room under R4000 near UWC")).toBe(false);
    expect(isListingQuestion("parking")).toBe(false);
  });

  it("should_treat_any_question_as_a_listing_question_when_asked_like_one", () => {
    expect(isListingQuestion("what colour are the walls?")).toBe(true);
  });
});

describe("answerListingFact", () => {
  it("should_answer_parking_from_the_listing", () => {
    expect(answerListingFact(listing, "parking")).toEqual({ known: true, answer: "Yes: 1 covered parking bay, included in the rent." });
  });

  it("should_say_no_parking_when_the_listing_says_none", () => {
    expect(answerListingFact({ ...listing, parking_type: "none", parking_count: 0 }, "parking")).toEqual({ known: true, answer: "No parking is listed for this place." });
  });

  it("should_send_pets_to_the_landlord_unless_the_listing_says_pet_friendly", () => {
    expect(answerListingFact(listing, "pets")).toEqual({ known: false });
    const petFriendly = { ...listing, metadata: { amenities: { essentials: ["pet_friendly"], security: [], lifestyle: [], appliances: [] } } };
    expect(answerListingFact(petFriendly, "pets")).toEqual({ known: true, answer: "Yes, the listing says it's pet friendly." });
  });

  it("should_answer_wifi_with_its_cost", () => {
    expect(answerListingFact(listing, "wifi")).toEqual({ known: true, answer: "Wi-Fi is available, about R300 a month extra." });
  });

  it("should_answer_the_deposit_and_how_it_is_paid", () => {
    expect(answerListingFact(listing, "deposit")).toEqual({ known: true, answer: "The deposit is R3,800. Approved renters can pay it through Pinpoint, which holds it until move-in." });
  });

  it("should_send_a_missing_deposit_to_the_landlord", () => {
    expect(answerListingFact({ ...listing, deposit_amount: null }, "deposit")).toEqual({ known: false });
  });

  it("should_answer_electricity_and_water", () => {
    expect(answerListingFact(listing, "electricity")).toEqual({ known: true, answer: "Prepaid electricity, not included: about R400 a month." });
    expect(answerListingFact(listing, "water")).toEqual({ known: true, answer: "Municipal water, included in the rent." });
  });

  it("should_answer_move_in_from_the_availability_date", () => {
    expect(answerListingFact(listing, "move-in", new Date("2026-11-24T10:00:00Z"))).toEqual({ known: true, answer: "Available from 1 December 2026." });
    expect(answerListingFact(listing, "move-in", new Date("2026-12-05T10:00:00Z"))).toEqual({ known: true, answer: "Available now." });
  });

  it("should_answer_from_amenities", () => {
    expect(answerListingFact(listing, "furnished")).toEqual({ known: true, answer: "Yes, it's furnished." });
    expect(answerListingFact(listing, "security")).toEqual({ known: true, answer: "Listed security: CCTV, Gated Complex." });
    expect(answerListingFact(listing, "backup-power")).toEqual({ known: true, answer: "Listed: Backup Power (Generator/Inverter)." });
    expect(answerListingFact(listing, "laundry")).toEqual({ known: true, answer: "Listed: Laundry." });
  });

  it("should_not_claim_unfurnished_when_furnished_is_simply_absent", () => {
    const bare = { ...listing, metadata: null };
    expect(answerListingFact(bare, "furnished")).toEqual({ known: false });
  });

  it("should_answer_the_lease_price_and_rooms", () => {
    expect(answerListingFact(listing, "lease")).toEqual({ known: true, answer: "The lease is 12 months." });
    expect(answerListingFact(listing, "price")).toEqual({ known: true, answer: "R3,800 a month." });
    expect(answerListingFact(listing, "bedrooms")).toEqual({ known: true, answer: "1 bedroom." });
    expect(answerListingFact(listing, "bathrooms")).toEqual({ known: true, answer: "1 bathroom." });
  });

  it("should_send_unknown_fees_to_the_landlord", () => {
    expect(answerListingFact(listing, "fees")).toEqual({ known: false });
    expect(answerListingFact({ ...listing, admin_fee: 500 }, "fees")).toEqual({ known: true, answer: "Admin fee: R500." });
  });
});
