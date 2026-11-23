// This module ships with the location picker on the home page, so it validates by hand:
// zod would add ~12 KB compressed to `/`, whose initial JS budget is 300 KB.

export const CATALOGUE_SEARCH_URL = "/api/discovery/places";
export const RECENT_LOCATION_KEY = "pinpoint:recent-location-ids:v1";
export const MAX_RECENT_LOCATIONS = 5;
const MAX_PLACES = 6;

export type CataloguePlace = {
  id: string;
  providerId: string;
  label: string;
  secondaryLabel: string;
  fullAddress: string;
  extentKind?: "source" | "viewport";
  center: { lat: number; lng: number };
  bounds: { west: number; east: number; south: number; north: number };
};
export type CatalogueResponse = { data: { places: CataloguePlace[]; recentPlaces: CataloguePlace[] } };

type ParseResult<T> = { success: true; data: T } | { success: false; error: Error };
/** The `parse`/`safeParse` surface callers already use. */
export type Validator<T> = { parse(value: unknown): T; safeParse(value: unknown): ParseResult<T> };

/** Thrown when a value does not meet the catalogue contract; `null` from a reader means invalid. */
export class CatalogueContractError extends Error {
  constructor(what: string) {
    super(`Invalid ${what}.`);
    this.name = "CatalogueContractError";
  }
}

function validator<T>(what: string, read: (value: unknown) => T | null): Validator<T> {
  const safeParse = (value: unknown): ParseResult<T> => {
    const data = read(value);
    return data === null ? { success: false, error: new CatalogueContractError(what) } : { success: true, data };
  };
  return {
    safeParse,
    parse(value) {
      const result = safeParse(value);
      if (!result.success) throw result.error;
      return result.data;
    },
  };
}

// Same pattern as zod 3's `z.string().uuid()`.
const UUID = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown, min: number, max: number): value is string =>
  typeof value === "string" && value.length >= min && value.length <= max;
const isCoordinate = (value: unknown, limit: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= -limit && value <= limit;

/** Reads every item, or returns null if the input is not an array of at most `max` valid items. */
function readList<T>(value: unknown, max: number, readItem: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const items: T[] = [];
  for (const item of value) {
    const read = readItem(item);
    if (read === null) return null;
    items.push(read);
  }
  return items;
}

function readPlace(value: unknown): CataloguePlace | null {
  if (!isRecord(value) || !isRecord(value.center) || !isRecord(value.bounds)) return null;
  const { id, providerId, label, secondaryLabel, fullAddress, extentKind } = value;
  const { lat, lng } = value.center;
  const { west, east, south, north } = value.bounds;
  if (!(typeof id === "string" && UUID.test(id))) return null;
  if (!isText(providerId, 0, 200) || !isText(label, 1, 300) || !isText(secondaryLabel, 0, 500) || !isText(fullAddress, 0, 1000)) return null;
  if (extentKind !== undefined && extentKind !== "source" && extentKind !== "viewport") return null;
  if (!isCoordinate(lat, 90) || !isCoordinate(lng, 180)) return null;
  if (!isCoordinate(west, 180) || !isCoordinate(east, 180) || !isCoordinate(south, 90) || !isCoordinate(north, 90)) return null;
  // The centre must sit inside non-empty bounds.
  if (!(west < east && south < north && lng >= west && lng <= east && lat >= south && lat <= north)) return null;
  return {
    id, providerId, label, secondaryLabel, fullAddress,
    ...(extentKind === undefined ? {} : { extentKind }),
    center: { lat, lng },
    bounds: { west, east, south, north },
  };
}

export const recentLocationIdsSchema = validator("recent location ids", value =>
  readList(value, MAX_RECENT_LOCATIONS, item => (typeof item === "string" && UUID.test(item) ? item : null)));

export const catalogueResponseSchema = validator<CatalogueResponse>("place catalogue response", value => {
  if (!isRecord(value) || !isRecord(value.data)) return null;
  const places = readList(value.data.places, MAX_PLACES, readPlace);
  const recentPlaces = value.data.recentPlaces === undefined ? [] : readList(value.data.recentPlaces, MAX_RECENT_LOCATIONS, readPlace);
  return places && recentPlaces ? { data: { places, recentPlaces } } : null;
});

/** Keep filter grammar and wildcard characters out of the database expression. */
export function locationSearchWords(query: string) {
  return query.toLocaleLowerCase("en-ZA").replace(/[^\p{L}\p{N}'-]+/gu, " ").trim().split(/\s+/).filter(Boolean);
}

export function locationMatches(place: { label: string; secondaryLabel: string }, query: string) {
  const text = `${place.label} ${place.secondaryLabel}`.toLocaleLowerCase("en-ZA");
  return locationSearchWords(query).every(word => text.includes(word));
}
