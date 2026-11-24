import type { FilterState } from "../filter-bar";

/** The address parameters the filter bar owns. */
export const FILTER_PARAM_KEYS = [
  "minPrice",
  "maxPrice",
  "beds",
  "baths",
  "type",
  "availableNow",
  "liveTours",
  "instantViewings",
  "repliesUnder5",
] as const;

function numberParam(params: URLSearchParams, key: string) {
  if (!params.has(key)) return undefined;
  const value = Number(params.get(key));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Reads discovery filters from the address. Anything that writes the URL (the filter bar,
 * the assistant, Back, a shared link) is reflected through this.
 */
export function filtersFromSearchParams(params: URLSearchParams): FilterState {
  const min = numberParam(params, "minPrice");
  const max = numberParam(params, "maxPrice");
  const propertyTypes = params.get("type")?.split(",").filter(Boolean);
  return {
    price: { min, max },
    beds: numberParam(params, "beds"),
    baths: numberParam(params, "baths"),
    propertyTypes: propertyTypes?.length ? propertyTypes : undefined,
    ...(params.has("availableNow") ? { availableNow: true } : {}),
    ...(params.has("liveTours") ? { liveTours: true } : {}),
    ...(params.has("instantViewings") ? { instantViewings: true } : {}),
    ...(params.has("repliesUnder5") ? { repliesUnder5: true } : {}),
  };
}
