import { isNewListing } from "@/features/listings/listing-freshness";

import { QUICK_FILTER_KEYS, type QuickFilterKey } from "./types";

export const RECENTLY_VIEWED_STORAGE_KEY = "roomza:recently-viewed-listings";
export const RECENTLY_VIEWED_LIMIT = 30;

export type RecentlyViewedEntry = {
  id: string;
  viewedAt: string;
};

type QuickFilterListing = {
  id: string;
  createdAt?: string | null;
  nsfasApproved?: boolean;
  furnished?: boolean;
};

export function parseQuickFilter(value: string | null, listingMode: "rent" | "buy" = "rent"): QuickFilterKey {
  if (!value || !QUICK_FILTER_KEYS.includes(value as QuickFilterKey)) return "all";
  if (listingMode === "buy" && value === "nsfas-approved") return "all";
  return value as QuickFilterKey;
}

export function parseRecentlyViewed(value: string | null): RecentlyViewedEntry[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const id = "id" in entry && typeof entry.id === "string" ? entry.id : "";
      const viewedAt = "viewedAt" in entry && typeof entry.viewedAt === "string" ? entry.viewedAt : "";
      if (!id || !viewedAt || !Number.isFinite(Date.parse(viewedAt)) || seen.has(id)) return [];
      seen.add(id);
      return [{ id, viewedAt }];
    }).slice(0, RECENTLY_VIEWED_LIMIT);
  } catch {
    return [];
  }
}

export function loadRecentlyViewed(): RecentlyViewedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return parseRecentlyViewed(window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(
  entries: RecentlyViewedEntry[],
  listingId: string,
  viewedAt = new Date().toISOString(),
): RecentlyViewedEntry[] {
  const next = [{ id: listingId, viewedAt }, ...entries.filter((entry) => entry.id !== listingId)]
    .slice(0, RECENTLY_VIEWED_LIMIT);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Browsing history is a progressive enhancement when storage is unavailable.
    }
  }
  return next;
}

export function applyQuickFilter<T extends QuickFilterListing>(
  listings: T[],
  quickFilter: QuickFilterKey,
  options: {
    favoriteIds?: ReadonlySet<string>;
    recentlyViewed?: readonly RecentlyViewedEntry[];
    now?: number;
  } = {},
): T[] {
  switch (quickFilter) {
    case "nsfas-approved":
      return listings.filter((listing) => listing.nsfasApproved);
    case "favourites":
      return listings.filter((listing) => options.favoriteIds?.has(listing.id));
    case "recently-listed":
      return listings
        .filter((listing) => isNewListing(listing.createdAt, options.now))
        .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
    case "recently-viewed": {
      const order = new Map((options.recentlyViewed ?? []).map((entry, index) => [entry.id, index]));
      return listings
        .filter((listing) => order.has(listing.id))
        .sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    }
    case "furnished":
      return listings.filter((listing) => listing.furnished);
    case "all":
    default:
      return [...listings];
  }
}
