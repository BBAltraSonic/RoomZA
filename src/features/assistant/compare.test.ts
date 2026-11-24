import { describe, expect, it } from "vitest";

import { compareRows, toggleCompare, MAX_COMPARE } from "./compare";
import type { FactListing } from "./listing-facts";

const base: FactListing = {
  id: "a",
  title: "A",
  listing_type: "rent",
  price: 4000,
  display_price: 4000,
  bedrooms: 1,
  bathrooms: 1,
  parking_type: "none",
  parking_count: 0,
  electricity_type: "prepaid",
  electricity_included: true,
  water_availability: "municipal",
  water_included: true,
  wifi_available: null,
  deposit_amount: null,
  lease_duration: "12_months",
  availability_date: "2026-01-01",
  metadata: { amenities: { essentials: ["furnished"], security: [], lifestyle: [], appliances: [] } },
};

describe("toggleCompare", () => {
  it("should_add_and_remove_listings", () => {
    expect(toggleCompare([], "a")).toEqual(["a"]);
    expect(toggleCompare(["a", "b"], "a")).toEqual(["b"]);
  });

  it("should_keep_at_most_three", () => {
    expect(MAX_COMPARE).toBe(3);
    expect(toggleCompare(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
  });
});

describe("compareRows", () => {
  const listings = [base, { ...base, id: "b", title: "B", price: 3500, display_price: 3500, bedrooms: 2, deposit_amount: 3500, metadata: null }];
  const rows = compareRows(listings, new Date("2026-11-24T10:00:00Z"));

  it("should_show_one_value_per_listing_in_each_row", () => {
    for (const row of rows) expect(row.values).toHaveLength(2);
  });

  it("should_mark_the_cheapest_price", () => {
    const price = rows.find((row) => row.label === "Price")!;
    expect(price.values).toEqual(["R4,000 a month", "R3,500 a month"]);
    expect(price.best).toEqual([1]);
  });

  it("should_mark_the_most_bedrooms", () => {
    const beds = rows.find((row) => row.label === "Bedrooms")!;
    expect(beds.values).toEqual(["1", "2"]);
    expect(beds.best).toEqual([1]);
  });

  it("should_say_not_listed_instead_of_guessing", () => {
    expect(rows.find((row) => row.label === "Deposit")!.values).toEqual(["Not listed", "R3,500"]);
    expect(rows.find((row) => row.label === "Furnished")!.values).toEqual(["Yes", "Not listed"]);
    expect(rows.find((row) => row.label === "Wi-Fi")!.values).toEqual(["Not listed", "Not listed"]);
  });

  it("should_not_mark_a_best_value_when_all_are_the_same", () => {
    expect(rows.find((row) => row.label === "Bathrooms")!.best).toEqual([]);
  });

  it("should_show_parking_and_move_in", () => {
    expect(rows.find((row) => row.label === "Parking")!.values).toEqual(["None", "None"]);
    expect(rows.find((row) => row.label === "Move in")!.values).toEqual(["Now", "Now"]);
  });
});
