import { describe, expect, it } from "vitest";
import { buildMyListings, parseListingCategory, PROPERTY_LISTINGS_HREF, type CategoryLoad, type ListingCategory } from "./my-listings";

const empty: CategoryLoad = { count: 0, hasMore: false, error: null };
const loads = (overrides: Partial<Record<ListingCategory, CategoryLoad>> = {}) => ({
  property: empty, services: empty, offers: empty, places: empty, events: empty, ...overrides,
});

describe("parseListingCategory", () => {
  it("should_accept_known_categories_and_reject_anything_else", () => {
    expect(parseListingCategory("property")).toBe("property");
    expect(parseListingCategory("events")).toBe("events");
    expect(parseListingCategory("dashboard")).toBeNull();
    expect(parseListingCategory(["property"])).toBeNull();
    expect(parseListingCategory(undefined)).toBeNull();
  });
});

describe("buildMyListings", () => {
  it("should_show_only_categories_the_person_lists_in_and_no_filter_for_one", () => {
    const view = buildMyListings(loads({ property: { count: 3, hasMore: false, error: null } }), null);
    expect(view.sections).toEqual(["property"]);
    expect(view.filters).toEqual([]);
    expect(view.isEmpty).toBe(false);
    expect(view.createHref).toBe("/post");
  });

  it("should_offer_a_filter_only_when_more_than_one_category_has_listings", () => {
    const view = buildMyListings(loads({
      property: { count: 2, hasMore: false, error: null },
      events: { count: 1, hasMore: false, error: null },
    }), null);
    expect(view.sections).toEqual(["property", "events"]);
    expect(view.filters.map(filter => [filter.label, filter.href, filter.count, filter.active])).toEqual([
      ["All", "/post/listings", 3, true],
      ["Property", PROPERTY_LISTINGS_HREF, 2, false],
      ["Events", "/post/listings?category=events", 1, false],
    ]);
  });

  it("should_narrow_to_the_requested_category_and_create_in_it_directly", () => {
    const view = buildMyListings(loads({
      property: { count: 2, hasMore: false, error: null },
      services: { count: 1, hasMore: false, error: null },
    }), "property");
    expect(view.sections).toEqual(["property"]);
    expect(view.filters.find(filter => filter.active)?.label).toBe("Property");
    expect(view.createHref).toBe("/dashboard/listings/new");
  });

  it("should_keep_a_requested_category_visible_even_when_it_is_empty", () => {
    const view = buildMyListings(loads({ services: { count: 1, hasMore: false, error: null } }), "property");
    expect(view.sections).toEqual(["property"]);
    expect(view.isEmpty).toBe(false);
  });

  it("should_be_empty_only_when_nothing_loaded_and_nothing_failed", () => {
    expect(buildMyListings(loads(), null).isEmpty).toBe(true);
    const failed = buildMyListings(loads({ offers: { count: 0, hasMore: false, error: "Offers could not load." } }), null);
    expect(failed.isEmpty).toBe(false);
    expect(failed.sections).toEqual(["offers"]);
  });

  it("should_count_more_than_one_page_as_at_least_that_many", () => {
    const view = buildMyListings(loads({ offers: { count: 20, hasMore: true, error: null }, places: { count: 1, hasMore: false, error: null } }), null);
    expect(view.filters.find(filter => filter.label === "Shopping Specials")?.count).toBe(20);
    expect(view.filters.find(filter => filter.label === "All")?.count).toBe(21);
  });
});
