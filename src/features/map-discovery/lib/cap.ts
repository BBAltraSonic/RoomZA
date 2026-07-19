// Marker capping pure function for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (Correctness Property 1).

import { MARKER_CLUSTER_THRESHOLD, MAX_MARKERS } from "./constants";

type ClusterableMarker = {
  id: string;
  coordinates: { lat: number; lng: number };
};

export type MarkerCluster<T extends ClusterableMarker> = {
  id: string;
  count: number;
  center: { lat: number; lng: number };
  markers: T[];
};

export type MarkerBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export function markerBounds<T extends ClusterableMarker>(markers: T[]): MarkerBounds | null {
  const first = markers[0];
  if (!first) return null;

  return markers.slice(1).reduce<MarkerBounds>(
    (bounds, marker) => ({
      north: Math.max(bounds.north, marker.coordinates.lat),
      south: Math.min(bounds.south, marker.coordinates.lat),
      east: Math.max(bounds.east, marker.coordinates.lng),
      west: Math.min(bounds.west, marker.coordinates.lng),
    }),
    {
      north: first.coordinates.lat,
      south: first.coordinates.lat,
      east: first.coordinates.lng,
      west: first.coordinates.lng,
    },
  );
}

/**
 * Cap a list to at most {@link MAX_MARKERS} items (Req 3.2, 3.7).
 *
 * Returns the first `min(items.length, MAX_MARKERS)` elements in input order.
 * Empty input yields empty output. Generic over the element type so it works
 * for both listings and card models.
 */
export function capListings<T>(items: T[]): T[] {
  return items.slice(0, MAX_MARKERS);
}

export function shouldClusterMarkers(markerCount: number) {
  return markerCount > MARKER_CLUSTER_THRESHOLD;
}

export function clusterMarkers<T extends ClusterableMarker>(
  markers: T[],
  gridSizeDegrees = 0.04,
): MarkerCluster<T>[] {
  if (!shouldClusterMarkers(markers.length)) {
    return markers.map((marker) => ({
      id: marker.id,
      count: 1,
      center: marker.coordinates,
      markers: [marker],
    }));
  }

  const buckets = new Map<string, T[]>();

  for (const marker of markers) {
    const latBucket = Math.floor(marker.coordinates.lat / gridSizeDegrees);
    const lngBucket = Math.floor(marker.coordinates.lng / gridSizeDegrees);
    const key = `${latBucket}:${lngBucket}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(marker);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries()).map(([key, bucket]) => {
    const center = bucket.reduce(
      (acc, marker) => ({
        lat: acc.lat + marker.coordinates.lat / bucket.length,
        lng: acc.lng + marker.coordinates.lng / bucket.length,
      }),
      { lat: 0, lng: 0 },
    );

    return {
      id: `cluster:${key}`,
      count: bucket.length,
      center,
      markers: bucket,
    };
  });
}
