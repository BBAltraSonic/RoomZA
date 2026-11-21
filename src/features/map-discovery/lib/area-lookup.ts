import { reverseGeocode, type MapCoordinates, type NormalizedLocation } from "@/lib/maptiler";

import { viewportSpecificity } from "./viewport-context";

/**
 * Grid cell, in degrees, inside which the map centre is treated as "the same
 * place" for each label specificity. Roughly: 11 km for a metro, 2 km for a
 * district, 450 m for a suburb and 110 m for a street. Panning within a cell
 * reuses the cached answer, so the header stays live without a geocoding call
 * on every small drag.
 */
const CELL_DEGREES = { metro: 0.1, district: 0.02, suburb: 0.004, street: 0.001, area: 0.004 } as const;
const MAX_ENTRIES = 128;
const TTL_MS = 30 * 60_000;

type Entry = { expires: number; feature: NormalizedLocation | null };
const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<NormalizedLocation | null>>();

/** The cache key for a camera: the same key means the same area label. */
export function areaLookupKey(center: MapCoordinates, zoom: number) {
  const specificity = viewportSpecificity(Math.round(zoom));
  const cell = CELL_DEGREES[specificity];
  return `${specificity}:${Math.round(center.lat / cell)}:${Math.round(center.lng / cell)}`;
}

/** A cached answer, `null` when the lookup found nothing, `undefined` when not cached. */
export function cachedAreaFeature(key: string): NormalizedLocation | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expires <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  // Refresh recency so the cache evicts the least recently used cell.
  cache.delete(key);
  cache.set(key, entry);
  return entry.feature;
}

function remember(key: string, feature: NormalizedLocation | null) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: Date.now() + TTL_MS, feature });
}

/**
 * Reverse-geocodes the map centre once per grid cell. Concurrent callers for
 * the same cell share one request. Aborting `signal` only stops this caller
 * from waiting; a request another caller still needs keeps running.
 */
export function lookupAreaFeature({ apiKey, center, zoom, signal }: {
  apiKey: string; center: MapCoordinates; zoom: number; signal?: AbortSignal;
}): Promise<NormalizedLocation | null> {
  const key = areaLookupKey(center, zoom);
  const cached = cachedAreaFeature(key);
  if (cached !== undefined) return Promise.resolve(cached);

  let request = inFlight.get(key);
  if (!request) {
    request = reverseGeocode({ apiKey, coordinates: center, signal: AbortSignal.timeout(8000) })
      .then((features) => {
        const feature = features[0] ?? null;
        remember(key, feature);
        return feature;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, request);
  }
  if (!signal) return request;
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    request.then(resolve, reject);
  });
}

/** Test-only: forget every cached and pending lookup. */
export function resetAreaLookupCache() {
  cache.clear();
  inFlight.clear();
}
