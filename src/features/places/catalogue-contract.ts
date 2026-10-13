import { z } from "zod";

export const CATALOGUE_SEARCH_URL = "/api/discovery/places";
export const RECENT_LOCATION_KEY = "pinpoint:recent-location-ids:v1";
export const MAX_RECENT_LOCATIONS = 5;

export const recentLocationIdsSchema = z.array(z.string().uuid()).max(MAX_RECENT_LOCATIONS);
export const cataloguePlaceSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string().max(200),
  label: z.string().min(1).max(300),
  secondaryLabel: z.string().max(500),
  fullAddress: z.string().max(1000),
  extentKind: z.enum(["source", "viewport"]).optional(),
  center: z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }),
  bounds: z.object({
    west: z.number().finite().min(-180).max(180), east: z.number().finite().min(-180).max(180),
    south: z.number().finite().min(-90).max(90), north: z.number().finite().min(-90).max(90),
  }),
}).refine(({ center, bounds }) => bounds.west < bounds.east && bounds.south < bounds.north &&
  center.lng >= bounds.west && center.lng <= bounds.east && center.lat >= bounds.south && center.lat <= bounds.north);

export const catalogueResponseSchema = z.object({ data: z.object({
  places: z.array(cataloguePlaceSchema).max(6),
  recentPlaces: z.array(cataloguePlaceSchema).max(MAX_RECENT_LOCATIONS).default([]),
}) });

/** Keep filter grammar and wildcard characters out of the database expression. */
export function locationSearchWords(query: string) {
  return query.toLocaleLowerCase("en-ZA").replace(/[^\p{L}\p{N}'-]+/gu, " ").trim().split(/\s+/).filter(Boolean);
}

export function locationMatches(place: { label: string; secondaryLabel: string }, query: string) {
  const text = `${place.label} ${place.secondaryLabel}`.toLocaleLowerCase("en-ZA");
  return locationSearchWords(query).every(word => text.includes(word));
}
