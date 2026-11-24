import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { discountPercent, formatDealPrice } from "./deal-format";
import * as dealSchema from "./deal-schema";

describe("deal-format", () => {
  it("should_format_free_whole_and_cent_prices", () => {
    expect(formatDealPrice(0)).toBe("Free");
    expect(formatDealPrice(15000)).toMatch(/^R150$/);
    expect(formatDealPrice(15050)).toMatch(/^R150[.,]50$/);
  });

  it("should_give_the_discount_only_when_the_price_is_below_the_original", () => {
    expect(discountPercent(7500, 10000)).toBe(25);
    expect(discountPercent(10000, 10000)).toBeNull();
    expect(discountPercent(undefined, 10000)).toBeNull();
  });

  it("should_stay_the_same_helpers_through_deal_schema", () => {
    expect(dealSchema.formatDealPrice).toBe(formatDealPrice);
    expect(dealSchema.discountPercent).toBe(discountPercent);
  });

  it("should_not_load_zod_so_display_only_pages_stay_light", () => {
    const source = readFileSync(path.join(__dirname, "deal-format.ts"), "utf8");
    expect(source).not.toMatch(/from ["']zod["']/);
  });
});
