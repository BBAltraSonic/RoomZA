export const DISCOVERY_SORT_OPTIONS = ["Latest", "Price: Low to High", "Price: High to Low", "Closest"] as const;

export const DISCOVERY_RANKING_FACTS = [
  "Discovery is limited to the active map area and the filters a user chooses.",
  `Results default to ${DISCOVERY_SORT_OPTIONS[0].toLowerCase()} listings.`,
  "Map-oriented results can use distance from the current search origin.",
  `Users can choose ${DISCOVERY_SORT_OPTIONS.map((option) => option.toLowerCase()).join(", ")} ordering.`,
  "Pinpoint does not currently sell a paid search-ranking boost.",
] as const;

export type DiscoverySortOption = (typeof DISCOVERY_SORT_OPTIONS)[number];
