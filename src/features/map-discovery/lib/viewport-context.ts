export type GeocodedAddressComponent = {
  long_name: string;
  types: string[];
};

export type ViewportSpecificity = "metro" | "district" | "suburb" | "street" | "area";

export type ViewportContext = {
  label: string;
  zoom: number;
  specificity: ViewportSpecificity;
};

export type MarkerDisplayMode = "density" | "mixed" | "prices";

function firstComponent(
  components: GeocodedAddressComponent[],
  types: string[],
) {
  for (const type of types) {
    const match = components.find((component) => component.types.includes(type));
    if (match?.long_name.trim()) {
      const label = match.long_name.trim();
      if (type === "administrative_area_level_2") {
        return label
          .replace(/^City of (.+?) Metropolitan Municipality$/i, "$1 metro")
          .replace(/\s+Metropolitan Municipality$/i, " metro")
          .replace(/\s+District Municipality$/i, " district");
      }
      return label;
    }
  }
  return null;
}

export function markerDisplayMode(zoom: number): MarkerDisplayMode {
  if (zoom <= 12) return "density";
  if (zoom <= 14) return "mixed";
  return "prices";
}

export function resolveViewportContext(
  zoom: number,
  components: GeocodedAddressComponent[],
): ViewportContext {
  if (zoom <= 10) {
    return {
      label: firstComponent(components, [
        "locality",
        "administrative_area_level_2",
        "administrative_area_level_1",
      ]) ?? "this area",
      zoom,
      specificity: "metro",
    };
  }

  if (zoom <= 13) {
    return {
      label: firstComponent(components, [
        "administrative_area_level_2",
        "sublocality_level_1",
        "sublocality",
        "locality",
      ]) ?? "this area",
      zoom,
      specificity: "district",
    };
  }

  if (zoom <= 16) {
    return {
      label: firstComponent(components, [
        "neighborhood",
        "sublocality_level_2",
        "sublocality_level_1",
        "sublocality",
        "locality",
      ]) ?? "this area",
      zoom,
      specificity: "suburb",
    };
  }

  const route = firstComponent(components, ["route"]);
  if (route) return { label: route, zoom, specificity: "street" };

  return {
    label: firstComponent(components, [
      "neighborhood",
      "sublocality_level_2",
      "sublocality_level_1",
      "sublocality",
      "locality",
    ]) ?? "this area",
    zoom,
    specificity: "suburb",
  };
}
