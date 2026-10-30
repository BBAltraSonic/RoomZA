import type { GeoPoint, ViewportBounds } from "./types";

/**
 * DOM markers are repositioned by MapLibre on every camera frame, so their count
 * is what limits pan and zoom smoothness. Clustering keeps a dense viewport
 * legible; this budget bounds the worst case.
 */
export const MAX_DOM_MARKERS = 60;

/** Pins this far outside the viewport are kept so panning does not reveal gaps. */
const VIEWPORT_MARGIN = 0.25;

type WindowablePin = { id: string; coordinates: GeoPoint };

export function paddedBounds(bounds: ViewportBounds, fraction = VIEWPORT_MARGIN): ViewportBounds {
  const width = (bounds.east - bounds.west) * fraction;
  const height = (bounds.north - bounds.south) * fraction;
  return {
    west: bounds.west - width,
    south: bounds.south - height,
    east: bounds.east + width,
    north: bounds.north + height,
  };
}

/** Input order is priority order: callers pass pins already ranked for display. */
export function windowMarkers<T extends WindowablePin>(
  pins: readonly T[],
  bounds: ViewportBounds,
  { keepIds = [] }: { keepIds?: readonly (string | undefined)[] } = {},
): T[] {
  const area = paddedBounds(bounds);
  const kept = new Set(keepIds.filter(Boolean));
  const pinned = pins.filter(pin => kept.has(pin.id));
  const inView = pins.filter(({ id, coordinates: { lat, lng } }) => !kept.has(id)
    && lng >= area.west && lng <= area.east && lat >= area.south && lat <= area.north);
  return [...pinned, ...inView.slice(0, Math.max(0, MAX_DOM_MARKERS - pinned.length))];
}

/** Clusters only change at whole zoom levels, so the map need not re-render between them. */
export function zoomBucket(zoom: number) {
  return Math.min(22, Math.max(0, Math.floor(zoom)));
}
