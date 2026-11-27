import { describe, expect, it } from "vitest";

import type { ListingDetail } from "@/features/listings/detail-cards/types";
import type { ListingCardModel } from "@/features/map-discovery/lib/types";
import { formatPrice } from "@/lib/utils";

import { summaryFacts, summaryFromDetail, summaryPrice, toFeedSummary } from "./feed-summary";

const card = {
  id: "a", title: "Garden cottage", area: "Parkhurst", imageUrls: ["https://cdn.test/a.jpg"], price: 6000,
  listingType: "rent", bedrooms: 1, bathrooms: 1, propertyType: "cottage", rating: null, reviewCount: null, distanceKm: null,
} satisfies ListingCardModel;

describe("feed summaries", () => {
  it("should_take_what_the_card_needs_from_a_result", () => {
    expect(toFeedSummary(card)).toEqual({
      id: "a", title: "Garden cottage", area: "Parkhurst", imageUrls: ["https://cdn.test/a.jpg"], price: 6000,
      listingType: "rent", bedrooms: 1, bathrooms: 1, propertyType: "cottage",
    });
  });

  it("should_build_a_summary_from_full_details_for_a_deep_link", () => {
    const detail = {
      id: "b", title: "Loft", address: "1 Long St, Cape Town", price: 1_500_000, sale_price: 1_450_000, listing_type: "sale",
      bedrooms: 2, bathrooms: 2, property_type: "apartment",
      images: [{ id: "i2", public_url: "https://cdn.test/2.jpg", sort_order: 2 }, { id: "i1", public_url: "https://cdn.test/1.jpg", sort_order: 1 }],
    } as ListingDetail;
    expect(summaryFromDetail(detail)).toMatchObject({
      id: "b", area: "1 Long St, Cape Town", price: 1_450_000, listingType: "sale",
      imageUrls: ["https://cdn.test/1.jpg", "https://cdn.test/2.jpg"],
    });
  });

  it("should_show_rent_per_month_and_sale_prices_plainly", () => {
    expect(summaryPrice(toFeedSummary(card))).toEqual({ amount: formatPrice(6000), suffix: "/month" });
    expect(summaryPrice({ ...toFeedSummary(card), listingType: "sale", price: 1_200_000 })).toEqual({ amount: formatPrice(1_200_000), suffix: null });
  });

  it("should_list_key_facts_in_one_line", () => {
    expect(summaryFacts(toFeedSummary(card))).toBe("1 bed · 1 bath · Cottage");
    expect(summaryFacts({ ...toFeedSummary(card), bedrooms: 0, bathrooms: 2, propertyType: null })).toBe("Open plan · 2 baths");
  });
});
