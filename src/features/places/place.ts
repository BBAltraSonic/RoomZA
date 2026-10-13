import type { NormalizedLocation } from "@/lib/maptiler";

export type DiscoveryPlace = {
  id: string;
  providerId: string;
  label: string;
  secondaryLabel: string;
  fullAddress: string;
  center: { lat: number; lng: number };
  bounds: { west: number; south: number; east: number; north: number };
  extentKind?: "source" | "viewport";
};

export type DiscoveryPlaceRow = {
  id: string;
  provider_id: string;
  name: string;
  region: string;
  full_address: string;
  center_lat: number;
  center_lng: number;
  west: number;
  south: number;
  east: number;
  north: number;
  extent_kind?: "source" | "viewport" | null;
};

const LEVELS = new Set(["neighbourhood", "locality", "place", "municipality"]);

export function placeInputFromGeocoder(location: NormalizedLocation) {
  const bounds = location.bounds;
  const country = location.hierarchy.country?.trim().toLowerCase();
  if (country !== "south africa" || !location.placeType || !LEVELS.has(location.placeType) || !bounds) return null;
  if (!location.id || !location.label || !location.fullAddress) return null;
  const { lat, lng } = location.center;
  const { west, south, east, north } = bounds;
  if (![lat, lng, west, south, east, north].every(Number.isFinite) ||
      west >= east || south >= north || lng < west || lng > east || lat < south || lat > north) return null;
  return {
    provider_id: location.id,
    level: location.placeType,
    name: location.label,
    region: location.secondaryLabel || "South Africa",
    full_address: location.fullAddress,
    center_lat: lat,
    center_lng: lng,
    west, south, east, north,
  };
}

export function toDiscoveryPlace(row: DiscoveryPlaceRow): DiscoveryPlace {
  return {
    id: row.id,
    providerId: row.provider_id,
    label: row.name,
    secondaryLabel: row.region,
    fullAddress: row.full_address,
    center: { lat: row.center_lat, lng: row.center_lng },
    bounds: { west: row.west, south: row.south, east: row.east, north: row.north },
    ...(row.extent_kind ? { extentKind: row.extent_kind } : {}),
  };
}
