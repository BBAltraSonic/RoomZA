// Great-circle distance for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (Data Models / pure functions).

import type { GeoPoint } from "./types";

/** Earth's mean radius in kilometers. */
const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance in kilometers between two points (haversine formula).
 *
 * Properties (Req 5.3, 6.3):
 * - Symmetric: `haversineKm(a, b) === haversineKm(b, a)`.
 * - Identity: distance between the same point is `0`.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_KM * c;
}
