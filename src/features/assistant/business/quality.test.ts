import { describe, expect, it } from "vitest";

import { checkListingQuality, needsImportantInfo, type QualityListing } from "./quality";

const complete: QualityListing = {
  id: "L1",
  title: "Room",
  description: "A bright, quiet room in a shared house close to the train station, with a shared kitchen, garden and secure parking for one car. Prepaid electricity.",
  price: 3800,
  listing_type: "rent",
  availability_date: "2026-12-01",
  deposit_amount: 3800,
  electricity_included: false,
  water_included: true,
  wifi_available: true,
  metadata: { amenities: { security: ["cctv"] } },
};

describe("checkListingQuality", () => {
  it("should_find_nothing_on_a_complete_listing", () => {
    expect(checkListingQuality(complete, { photoCount: 8, hasViewingHours: true })).toEqual([]);
  });

  it("should_flag_missing_photos_costs_and_description_as_important", () => {
    const issues = checkListingQuality({ ...complete, description: "Nice room", deposit_amount: null }, { photoCount: 0, hasViewingHours: true });
    expect(issues.map((issue) => [issue.key, issue.severity])).toEqual([
      ["no-photos", "important"],
      ["short-description", "important"],
      ["no-move-in-costs", "important"],
    ]);
    expect(needsImportantInfo(issues)).toBe(true);
  });

  it("should_flag_helpful_gaps_with_one_fix_each", () => {
    const issues = checkListingQuality({ ...complete, availability_date: null, metadata: null, electricity_included: null, water_included: null, wifi_available: null }, { photoCount: 3, hasViewingHours: false });
    expect(issues.map((issue) => issue.fix)).toEqual(["Add photos", "Add move-in date", "Add utilities", "Add features", "Set viewing hours"]);
    expect(needsImportantInfo(issues)).toBe(false);
  });

  it("should_not_ask_sales_for_rental_details", () => {
    const issues = checkListingQuality({ ...complete, listing_type: "sale", deposit_amount: null, availability_date: null }, { photoCount: 8, hasViewingHours: false });
    expect(issues).toEqual([]);
  });
});
