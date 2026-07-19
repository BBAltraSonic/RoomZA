export const LISTING_SEARCH_QUERY_MAX_LENGTH = 120;

export function normalizeListingSearchQuery(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LISTING_SEARCH_QUERY_MAX_LENGTH)
    .trimEnd();
}

export function limitListingSearchDraft(value: string) {
  return value.slice(0, LISTING_SEARCH_QUERY_MAX_LENGTH);
}
