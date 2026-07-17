export function buildPlaceRecenterRequest(placeId: string | null | undefined) {
  const normalizedPlaceId = placeId?.trim();
  return normalizedPlaceId ? { placeId: normalizedPlaceId } : null;
}

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
