type ListingWithStatus = {
  status: string;
};

export type ListingVisibilityStatus = "draft" | "published" | "archived";

export function countPublishedListings<T extends ListingWithStatus>(listings: T[]) {
  return listings.filter((listing) => listing.status === "published").length;
}

export function countDraftListings<T extends ListingWithStatus>(listings: T[]) {
  return listings.filter((listing) => listing.status === "draft").length;
}

export function getListingStatusTone(status: string) {
  return status === "published" ? "forest" : "warning";
}

export function isDraftListing(status: string) {
  return status === "draft";
}

export function canPublishListing(status: ListingVisibilityStatus) {
  return status === "draft";
}

export function canUnpublishListing(status: ListingVisibilityStatus) {
  return status === "published";
}

export function visibilityToggleTarget(status: ListingVisibilityStatus): ListingVisibilityStatus | null {
  if (status === "draft") return "published";
  if (status === "published") return "draft";
  return null;
}
