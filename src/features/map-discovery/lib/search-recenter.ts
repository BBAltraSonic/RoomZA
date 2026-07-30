export function shouldRequestInitialUserLocation({
  initialCenter,
  searchQuery,
  selectedListingId,
}: {
  initialCenter?: { lat: number; lng: number };
  searchQuery?: string;
  selectedListingId?: string;
}) {
  return !initialCenter && !searchQuery?.trim() && !selectedListingId;
}
