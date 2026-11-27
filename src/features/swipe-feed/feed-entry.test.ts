import { describe, expect, it } from "vitest";

import { feedEntry } from "./feed-entry";

const params = (query = "") => new URLSearchParams(query);

describe("feedEntry", () => {
  it("should_stay_closed_when_the_flag_is_off", () => {
    expect(feedEntry({ enabled: false, searchParams: params("view=feed&listingId=a"), pathname: "/" })).toEqual({ open: false, target: "a" });
  });

  it("should_open_at_the_first_result_for_view_feed", () => {
    expect(feedEntry({ enabled: true, searchParams: params("view=feed"), pathname: "/" })).toEqual({ open: true, target: null });
  });

  it("should_open_at_the_listing_the_address_names", () => {
    expect(feedEntry({ enabled: true, searchParams: params("listingId=a"), pathname: "/" })).toEqual({ open: true, target: "a" });
  });

  it("should_open_a_listing_page_at_its_listing_even_when_it_is_gone", () => {
    expect(feedEntry({ enabled: true, searchParams: params(), pathname: "/listing/gone", routeListingId: "gone" })).toEqual({ open: true, target: "gone" });
  });

  it("should_stay_on_the_map_when_nothing_asks_for_the_feed", () => {
    expect(feedEntry({ enabled: true, searchParams: params("mode=buy"), pathname: "/" })).toEqual({ open: false, target: null });
  });
});
