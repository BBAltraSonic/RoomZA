import type { NormalizedLocation } from "@/lib/maptiler";

export type ViewportSpecificity = "metro" | "district" | "suburb" | "street" | "area";

export type ViewportContext = {
  label: string;
  zoom: number;
  specificity: ViewportSpecificity;
};

export type MarkerDisplayMode = "density" | "prices" | "details";

export function markerDisplayMode(zoom: number): MarkerDisplayMode {
  if (zoom <= 12) return "density";
  return zoom <= 14 ? "prices" : "details";
}

function normalizedAdministrativeLabel(label: string) {
  return label
    .replace(/^City of (.+?) Metropolitan Municipality$/i, "$1 metro")
    .replace(/\s+Metropolitan Municipality$/i, " metro")
    .replace(/\s+District Municipality$/i, " district");
}

/** Electoral wards ("Cape Town Ward 58") mean nothing to someone looking for a home. */
const WARD_LABEL = /\bward\s*\d+\b/i;

/** The label detail a zoom level shows, matching `resolveLocationViewportContext`. */
export function viewportSpecificity(zoom: number): ViewportSpecificity {
  if (zoom <= 10) return "metro";
  if (zoom <= 13) return "district";
  return zoom <= 16 ? "suburb" : "street";
}

function firstLocationLabel(
  feature: NormalizedLocation | undefined,
  keys: Array<keyof NormalizedLocation["hierarchy"]>,
) {
  for (const key of keys) {
    const label = feature?.hierarchy[key]?.trim();
    if (label && !WARD_LABEL.test(label)) return normalizedAdministrativeLabel(label);
  }
  return null;
}

export function resolveLocationViewportContext(
  zoom: number,
  feature?: NormalizedLocation,
): ViewportContext {
  if (zoom <= 10) {
    return {
      label: firstLocationLabel(feature, ["municipality", "place", "region", "subregion"]) ?? "this area",
      zoom,
      specificity: "metro",
    };
  }

  if (zoom <= 13) {
    return {
      label: firstLocationLabel(feature, ["municipal_district", "municipality", "locality", "place"]) ?? "this area",
      zoom,
      specificity: "district",
    };
  }

  if (zoom <= 16) {
    return {
      label: firstLocationLabel(feature, ["neighbourhood", "locality", "place", "municipality"]) ?? "this area",
      zoom,
      specificity: "suburb",
    };
  }

  const street = firstLocationLabel(feature, ["road"]);
  const featureName = feature?.placeType === "road" || feature?.placeType === "address"
    ? feature.label.trim()
    : null;
  if (street || featureName) {
    return { label: street ?? featureName!, zoom, specificity: "street" };
  }

  return {
    label: firstLocationLabel(feature, ["neighbourhood", "locality", "place", "municipality"]) ?? "this area",
    zoom,
    specificity: "suburb",
  };
}
