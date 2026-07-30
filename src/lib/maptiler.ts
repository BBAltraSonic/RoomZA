import {
  MapStyle,
  type GeocodingFeature,
  type GeocodingPlaceType,
  type GeocodingSearchResult,
} from "@maptiler/client";

export type MapCoordinates = {
  lat: number;
  lng: number;
};

export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type NormalizedLocation = {
  id: string;
  label: string;
  secondaryLabel?: string;
  fullAddress: string;
  center: MapCoordinates;
  bounds?: MapBounds;
  placeType?: GeocodingPlaceType;
  hierarchy: Partial<Record<GeocodingPlaceType, string>>;
  categories: string[];
};

type ForwardGeocodeOptions = {
  apiKey: string;
  query: string;
  limit?: number;
  bounds?: MapBounds;
  proximity?: MapCoordinates;
  types?: GeocodingPlaceType[];
  autocomplete?: boolean;
  signal?: AbortSignal;
};

type ReverseGeocodeOptions = {
  apiKey: string;
  coordinates: MapCoordinates;
  types?: GeocodingPlaceType[];
  signal?: AbortSignal;
};

const MAPTILER_GEOCODING_BASE = "https://api.maptiler.com/geocoding";

function normalizedApiKey(apiKey: string) {
  const value = apiKey.trim();
  if (!value) throw new Error("A MapTiler API key is required.");
  return value;
}

function finiteBounds(value: GeocodingFeature["bbox"] | undefined): MapBounds | undefined {
  if (!value || value.length !== 4 || !value.every(Number.isFinite)) return undefined;
  return {
    west: value[0],
    south: value[1],
    east: value[2],
    north: value[3],
  };
}

function featureTypeFromId(id: string): GeocodingPlaceType | undefined {
  const prefix = id.split(".", 1)[0];
  if (!prefix) return undefined;
  const normalized = prefix === "neighborhood" ? "neighbourhood" : prefix;
  return normalized as GeocodingPlaceType;
}

export function normalizeMapTilerFeature(feature: GeocodingFeature): NormalizedLocation | null {
  const lng = feature.center[0];
  const lat = feature.center[1];
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const hierarchy: Partial<Record<GeocodingPlaceType, string>> = {};
  const placeType = feature.place_type[0];
  if (placeType && feature.text.trim()) hierarchy[placeType] = feature.text.trim();
  for (const context of feature.context ?? []) {
    const type = featureTypeFromId(context.id);
    const label = context.text?.trim();
    if (type && label) hierarchy[type] = label;
  }

  const baseLabel = feature.text.trim();
  const label = feature.address ? `${feature.address} ${baseLabel}`.trim() : baseLabel;
  const fullAddress = feature.place_name.trim() || label;
  const secondaryLabel = fullAddress
    .replace(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*,?\\s*`, "i"), "")
    .trim();

  return {
    id: feature.id,
    label,
    secondaryLabel: secondaryLabel || undefined,
    fullAddress,
    center: { lat: lat!, lng: lng! },
    bounds: finiteBounds(feature.bbox),
    placeType,
    hierarchy,
    categories: feature.properties.categories ?? [],
  };
}

function appendBounds(params: URLSearchParams, bounds?: MapBounds) {
  if (!bounds) return;
  params.set("bbox", [bounds.west, bounds.south, bounds.east, bounds.north].join(","));
}

function appendTypes(params: URLSearchParams, types?: GeocodingPlaceType[]) {
  if (types?.length) params.set("types", types.join(","));
}

async function requestLocations(
  path: string,
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<NormalizedLocation[]> {
  const response = await fetch(`${MAPTILER_GEOCODING_BASE}/${path}.json?${params.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`MapTiler geocoding failed with status ${response.status}.`);
  }
  const payload = await response.json() as GeocodingSearchResult;
  return payload.features.flatMap((feature) => {
    const normalized = normalizeMapTilerFeature(feature);
    return normalized ? [normalized] : [];
  });
}

export function getMapTilerStyleUrl(apiKey: string, dark: boolean) {
  const styleId = dark ? MapStyle.BASE.DARK.getId() : MapStyle.BASE.LIGHT.getId();
  return `https://api.maptiler.com/maps/${styleId}/style.json?key=${encodeURIComponent(normalizedApiKey(apiKey))}`;
}

export function forwardGeocode({
  apiKey,
  query,
  limit = 6,
  bounds,
  proximity,
  types,
  autocomplete = true,
  signal,
}: ForwardGeocodeOptions) {
  const params = new URLSearchParams({
    key: normalizedApiKey(apiKey),
    country: "za",
    language: "en",
    limit: String(Math.min(10, Math.max(1, limit))),
    autocomplete: String(autocomplete),
  });
  appendBounds(params, bounds);
  appendTypes(params, types);
  if (proximity) params.set("proximity", `${proximity.lng},${proximity.lat}`);
  return requestLocations(encodeURIComponent(query.trim()), params, signal);
}

export function reverseGeocode({
  apiKey,
  coordinates,
  types,
  signal,
}: ReverseGeocodeOptions) {
  const params = new URLSearchParams({
    key: normalizedApiKey(apiKey),
    language: "en",
    limit: "1",
  });
  appendTypes(params, types);
  return requestLocations(`${coordinates.lng},${coordinates.lat}`, params, signal);
}
