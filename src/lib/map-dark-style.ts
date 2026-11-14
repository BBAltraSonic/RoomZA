"use client";

import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { useEffect, useReducer } from "react";

import { getMapTilerStyleUrl } from "./maptiler";

/**
 * Night palette for the map: neutral charcoal land, lighter grey streets on
 * top of it, faintly raised building blocks and soft white labels. MapTiler's
 * stock dark style draws roads darker than the land, which reads as cracks
 * rather than streets at neighbourhood zoom.
 */
export const DARK_MAP_PALETTE = {
  land: "#2c2c2e",
  residential: "#2e2e30",
  building: "#38383b",
  buildingOutline: "#444447",
  vegetation: "#26302a",
  glacier: "#30363a",
  sand: "rgba(72, 66, 54, 0.35)",
  water: "#1c2733",
  roadMinor: "#47474a",
  roadMedium: "#58585c",
  roadMajor: "#6c6c71",
  path: "#3e3e41",
  rail: "#404043",
  railDash: "rgba(128, 128, 133, 0.5)",
  bridge: "#3a3a3d",
  border: "rgba(160, 160, 166, 0.45)",
  // Ward and suburb lines: present for orientation, never louder than a street.
  subBorder: "rgba(160, 160, 166, 0.16)",
  label: "#d1d1d6",
  labelStrong: "#ececf0",
  labelHalo: "rgba(28, 28, 30, 0.9)",
} as const;

type Paint = Record<string, unknown>;
type Layout = Record<string, unknown>;
type Override = { paint?: Paint; layout?: Layout };

const P = DARK_MAP_PALETTE;

const ROAD_COLOR = [
  "match",
  ["get", "class"],
  ["motorway", "trunk"],
  P.roadMajor,
  ["primary", "secondary"],
  P.roadMedium,
  P.roadMinor,
];

const streetLabel: Override = {
  paint: { "text-color": P.label, "text-halo-color": P.labelHalo },
  layout: {
    "text-transform": "none",
    "text-letter-spacing": 0,
    "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 16, 12, 18, 13, 20, 14],
  },
};
const placeLabel: Override = { paint: { "text-color": P.label, "text-halo-color": P.labelHalo } };
const regionLabel: Override = { paint: { "text-color": P.labelStrong, "text-halo-color": P.labelHalo } };
const fill = (color: string): Override => ({ paint: { "fill-color": color } });
const line = (color: string): Override => ({ paint: { "line-color": color } });

// Keyed by vector-tile source layer rather than layer id: ids are display
// names MapTiler may rename, while the tile schema is versioned.
const OVERRIDES: Record<string, (layer: LayerSpecification) => Override | null> = {
  residential: () => fill(P.residential),
  vegetation: () => fill(P.vegetation),
  scrub: () => fill(P.vegetation),
  forest: () => fill(P.vegetation),
  grass: () => fill(P.vegetation),
  wood: () => fill(P.vegetation),
  ice: () => fill(P.glacier),
  sand: () => fill(P.sand),
  water: (layer) => (layer.type === "line" ? line(P.water) : fill(P.water)),
  waterway: () => line(P.water),
  bridge: () => fill(P.bridge),
  pier: () => fill(P.bridge),
  building: () => ({ paint: { "fill-color": P.building, "fill-outline-color": P.buildingOutline } }),
  road: (layer) => (layer.type === "line" ? { paint: { "line-color": ROAD_COLOR } } : null),
  pathway: () => line(P.path),
  aviation_line: () => line(P.path),
  railway: (layer) => line(hasDashes(layer) ? P.railDash : P.rail),
  sub_border: () => line(P.subBorder),
  country_border: () => line(P.border),
  country_border_disputed: () => line(P.border),
  road_label: () => streetLabel,
  pathway_label: () => streetLabel,
  poi_station: () => placeLabel,
  place_label: () => placeLabel,
  town_label: () => placeLabel,
  city_label: () => regionLabel,
  country_label: () => regionLabel,
  country_disputed_label: () => regionLabel,
  continent_label: () => regionLabel,
};

function hasDashes(layer: LayerSpecification) {
  return Boolean((layer.paint as Paint | undefined)?.["line-dasharray"]);
}

function overrideFor(layer: LayerSpecification): Override | null {
  if (layer.type === "background") return { paint: { "background-color": P.land } };
  const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
  if (!sourceLayer) return null;
  return OVERRIDES[sourceLayer]?.(layer) ?? null;
}

/** Returns a copy of MapTiler's dark base style recoloured with the night palette. */
export function restyleDarkMap(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const override = overrideFor(layer);
      if (!override) return layer;
      return {
        ...layer,
        ...(override.paint ? { paint: { ...(layer.paint as Paint | undefined), ...override.paint } } : {}),
        ...(override.layout ? { layout: { ...(layer.layout as Layout | undefined), ...override.layout } } : {}),
      } as LayerSpecification;
    }),
  };
}

const pending = new Map<string, Promise<StyleSpecification>>();
const settled = new Map<string, StyleSpecification | "failed">();

/** Fetches a dark style once per URL and resolves to its restyled copy. Failed loads are not cached. */
export function loadDarkMapStyle(url: string): Promise<StyleSpecification> {
  const existing = pending.get(url);
  if (existing) return existing;
  const request = fetch(url, { headers: { Accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) throw new Error(`MapTiler style request failed with status ${response.status}.`);
      const style = restyleDarkMap(await response.json() as StyleSpecification);
      settled.set(url, style);
      return style;
    })
    .catch((error: unknown) => {
      pending.delete(url);
      settled.set(url, "failed");
      throw error;
    });
  pending.set(url, request);
  return request;
}

/** Test hook: forget every loaded style. */
export function resetDarkMapStyleCache() {
  pending.clear();
  settled.clear();
}

/**
 * The style to hand a MapLibre map. Light mode uses MapTiler's URL as-is; dark
 * mode resolves to the restyled night map, or to the stock dark URL if that
 * cannot be fetched. Returns null while there is no key or the night style is
 * still loading, so callers can hold the map instead of flashing the stock one.
 */
export function useMapTilerStyle(apiKey: string | null | undefined, dark: boolean): string | StyleSpecification | null {
  const url = apiKey?.trim() ? getMapTilerStyleUrl(apiKey, dark) : null;
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const loaded = url && dark ? settled.get(url) : undefined;

  useEffect(() => {
    if (!url || !dark || loaded !== undefined) return;
    let active = true;
    loadDarkMapStyle(url).then(
      () => active && rerender(),
      () => active && rerender(),
    );
    return () => {
      active = false;
    };
  }, [dark, loaded, url]);

  if (!url) return null;
  if (!dark) return url;
  if (loaded === undefined) return null;
  return loaded === "failed" ? url : loaded;
}
