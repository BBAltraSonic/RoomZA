import { describe, expect, it } from "vitest";

import { relaxSuggestion, relaxedMaxPrice, RELAX_WHEN_FEWER_THAN } from "./relax";

describe("relaxedMaxPrice", () => {
  it("should_step_rent_up_by_about_an_eighth_to_a_round_number", () => {
    expect(relaxedMaxPrice(4000, "rent")).toBe(4500);
    expect(relaxedMaxPrice(3000, "rent")).toBe(3500);
    expect(relaxedMaxPrice(10000, "rent")).toBe(11500);
  });

  it("should_step_sale_prices_to_the_next_50_thousand", () => {
    expect(relaxedMaxPrice(1_500_000, "buy")).toBe(1_700_000);
  });
});

describe("relaxSuggestion", () => {
  it("should_offer_a_higher_budget_when_results_are_few", () => {
    const params = new URLSearchParams("maxPrice=4000&beds=1");
    expect(relaxSuggestion(params, 2, "rent")).toEqual({ maxPrice: 4500, query: "maxPrice=4500&beds=1" });
  });

  it("should_not_offer_when_there_are_enough_results", () => {
    expect(relaxSuggestion(new URLSearchParams("maxPrice=4000"), RELAX_WHEN_FEWER_THAN, "rent")).toBeNull();
  });

  it("should_not_offer_without_a_budget", () => {
    expect(relaxSuggestion(new URLSearchParams("beds=2"), 0, "rent")).toBeNull();
  });

  it("should_not_go_below_the_minimum_price", () => {
    expect(relaxSuggestion(new URLSearchParams("minPrice=5000&maxPrice=4000"), 0, "rent")).toEqual({ maxPrice: 4500, query: "minPrice=5000&maxPrice=4500" });
  });
});
