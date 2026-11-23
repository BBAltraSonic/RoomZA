/**
 * One My listings page for every category. This module decides what the page shows:
 * which categories appear (only the ones the person lists in), whether a filter is worth
 * showing (only with more than one), and where Create listing leads.
 */

export const LISTING_CATEGORIES = ["property", "services", "offers", "places", "events"] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const MY_LISTINGS_HREF = "/post/listings";
export const PROPERTY_LISTINGS_HREF = `${MY_LISTINGS_HREF}?category=property`;

export const listingCategoryMeta: Record<ListingCategory, { label: string; createHref: string; workspaceHref: string }> = {
  property: { label: "Property", createHref: "/dashboard/listings/new", workspaceHref: PROPERTY_LISTINGS_HREF },
  services: { label: "Services", createHref: "/post/services", workspaceHref: "/post/services" },
  offers: { label: "Shopping Specials", createHref: "/post/offers", workspaceHref: "/post/offers" },
  places: { label: "Places", createHref: "/post/entries/tourism", workspaceHref: "/post/entries/tourism" },
  events: { label: "Events", createHref: "/post/entries/event", workspaceHref: "/post/entries/event" },
};

/** What one category's loader found: how many listings (a lower bound when `hasMore`), or why it failed. */
export type CategoryLoad = { count: number; hasMore: boolean; error: string | null };

export type MyListingsFilter = { label: string; href: string; count: number; active: boolean };

export type MyListings = {
  /** Categories to render, in a fixed order. */
  sections: ListingCategory[];
  /** Empty unless more than one category has listings. */
  filters: MyListingsFilter[];
  active: ListingCategory | null;
  isEmpty: boolean;
  createHref: string;
  /** Why a category could not load, keyed by category. */
  errors: Partial<Record<ListingCategory, string>>;
};

export function parseListingCategory(value: unknown): ListingCategory | null {
  return typeof value === "string" && (LISTING_CATEGORIES as readonly string[]).includes(value) ? value as ListingCategory : null;
}

export function categoryHref(category: ListingCategory | null) {
  return category ? `${MY_LISTINGS_HREF}?category=${category}` : MY_LISTINGS_HREF;
}

export function buildMyListings(loads: Record<ListingCategory, CategoryLoad>, requested: ListingCategory | null): MyListings {
  // A failed category still shows, so the person learns it failed rather than thinking it is empty.
  const present = LISTING_CATEGORIES.filter(category => loads[category].count > 0 || loads[category].error);
  const listed = LISTING_CATEGORIES.filter(category => loads[category].count > 0);
  const total = listed.reduce((sum, category) => sum + loads[category].count, 0);
  const filters = listed.length > 1 ? [
    { label: "All", href: MY_LISTINGS_HREF, count: total, active: requested === null },
    ...listed.map(category => ({
      label: listingCategoryMeta[category].label, href: categoryHref(category), count: loads[category].count, active: requested === category,
    })),
  ] : [];
  return {
    sections: requested ? [requested] : present,
    filters,
    active: requested,
    isEmpty: !requested && present.length === 0,
    createHref: requested ? listingCategoryMeta[requested].createHref : "/post",
    errors: Object.fromEntries(LISTING_CATEGORIES.flatMap(category => loads[category].error ? [[category, loads[category].error]] : [])),
  };
}
