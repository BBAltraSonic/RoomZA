type ListingForAlertMatch = {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  price: number;
  salePrice: number | null;
  listingType: "rent" | "sale";
  bedrooms: number;
  bathrooms: number;
  propertyType: string | null;
};

type SavedListingRow = {
  user_id: string;
};

type SearchAlertRow = {
  user_id: string | null;
  email: string;
  bounding_box_west: number;
  bounding_box_south: number;
  bounding_box_east: number;
  bounding_box_north: number;
  filters: unknown;
};

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function matchesFilters(
  listing: ListingForAlertMatch,
  rawFilters: unknown,
) {
  const filters = record(rawFilters);
  const price = record(filters.price);
  const minPrice = finiteNumber(filters.minPrice) ?? finiteNumber(price.min);
  const maxPrice = finiteNumber(filters.maxPrice) ?? finiteNumber(price.max);
  const minBeds = finiteNumber(filters.beds);
  const minBaths = finiteNumber(filters.baths);
  const mode = filters.mode;
  const expectedType = mode === "buy" ? "sale" : mode === "rent" ? "rent" : null;
  const displayPrice = listing.listingType === "sale"
    ? listing.salePrice ?? listing.price
    : listing.price;
  const query = typeof filters.q === "string"
    ? filters.q.trim().toLocaleLowerCase("en-ZA")
    : "";
  const propertyTypes = Array.isArray(filters.propertyTypes)
    ? filters.propertyTypes.filter((value): value is string => typeof value === "string")
    : typeof filters.type === "string"
      ? [filters.type]
      : [];

  return (
    (!expectedType || listing.listingType === expectedType)
    && (minPrice === null || displayPrice >= minPrice)
    && (maxPrice === null || displayPrice <= maxPrice)
    && (minBeds === null || listing.bedrooms >= minBeds)
    && (minBaths === null || listing.bathrooms >= minBaths)
    && (
      propertyTypes.length === 0
      || Boolean(
        listing.propertyType
        && propertyTypes.includes(listing.propertyType),
      )
    )
    && (
      !query
      || `${listing.title} ${listing.address}`
        .toLocaleLowerCase("en-ZA")
        .includes(query)
    )
  );
}

function containsListing(
  alert: SearchAlertRow,
  listing: ListingForAlertMatch,
) {
  return (
    listing.longitude >= alert.bounding_box_west
    && listing.longitude <= alert.bounding_box_east
    && listing.latitude >= alert.bounding_box_south
    && listing.latitude <= alert.bounding_box_north
  );
}

export function selectTourAlertAudience({
  listing,
  savedListings,
  searchAlerts,
  searchAlertsDisabledFor = [],
}: {
  listing: ListingForAlertMatch;
  savedListings: SavedListingRow[];
  searchAlerts: SearchAlertRow[];
  searchAlertsDisabledFor?: string[];
}) {
  const savedRecipientIds = new Set(
    savedListings.map((favorite) => favorite.user_id),
  );
  const disabled = new Set(searchAlertsDisabledFor);
  const searchRecipientIds = new Set<string>();
  const anonymousEmails = new Set<string>();

  for (const alert of searchAlerts) {
    if (!containsListing(alert, listing) || !matchesFilters(listing, alert.filters)) {
      continue;
    }

    if (alert.user_id) {
      if (!disabled.has(alert.user_id)) searchRecipientIds.add(alert.user_id);
    } else {
      anonymousEmails.add(alert.email.trim().toLocaleLowerCase("en-ZA"));
    }
  }

  return {
    recipientIds: [...new Set([
      ...savedRecipientIds,
      ...searchRecipientIds,
    ])],
    anonymousEmails: [...anonymousEmails],
  };
}
