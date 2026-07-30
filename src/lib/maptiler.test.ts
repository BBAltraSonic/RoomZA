import { afterEach, describe, expect, it, vi } from "vitest";
import type { GeocodingFeature } from "@maptiler/client";

import {
  forwardGeocode,
  getMapTilerStyleUrl,
  normalizeMapTilerFeature,
  reverseGeocode,
} from "./maptiler";

const FEATURE = {
  id: "address.123",
  type: "Feature",
  geometry: { type: "Point", coordinates: [18.4241, -33.9249] },
  properties: { ref: "osm:1", country_code: "za", categories: ["restaurant"] },
  text: "Main Road",
  address: "12",
  center: [18.4241, -33.9249],
  bbox: [18.42, -33.93, 18.43, -33.92],
  place_name: "12 Main Road, Sea Point, Cape Town",
  place_type: ["address"],
  place_type_name: ["Address"],
  relevance: 1,
  context: [
    { id: "neighbourhood.sea-point", text: "Sea Point", ref: "osm:2", country_code: "za" },
    { id: "municipality.cape-town", text: "City of Cape Town Metropolitan Municipality", ref: "osm:3", country_code: "za" },
  ],
} as GeocodingFeature;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MapTiler location adapter", () => {
  it("normalizes coordinates, bounds, address, hierarchy, and categories", () => {
    expect(normalizeMapTilerFeature(FEATURE)).toEqual({
      id: "address.123",
      label: "12 Main Road",
      secondaryLabel: "Sea Point, Cape Town",
      fullAddress: "12 Main Road, Sea Point, Cape Town",
      center: { lat: -33.9249, lng: 18.4241 },
      bounds: { west: 18.42, south: -33.93, east: 18.43, north: -33.92 },
      placeType: "address",
      hierarchy: {
        address: "Main Road",
        neighbourhood: "Sea Point",
        municipality: "City of Cape Town Metropolitan Municipality",
      },
      categories: ["restaurant"],
    });
  });

  it("uses Base v4 light and dark style URLs without mutating global client config", () => {
    expect(getMapTilerStyleUrl("public-key", false))
      .toBe("https://api.maptiler.com/maps/base-v4-light/style.json?key=public-key");
    expect(getMapTilerStyleUrl("public-key", true))
      .toBe("https://api.maptiler.com/maps/base-v4-dark/style.json?key=public-key");
  });

  it("sends bounded South African forward geocoding requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [FEATURE], query: [], attribution: "MapTiler" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await forwardGeocode({
      apiKey: "public-key",
      query: "12 Main Road",
      limit: 6,
      bounds: { west: 18.3, south: -34.1, east: 18.7, north: -33.7 },
      proximity: { lat: -33.92, lng: 18.42 },
      types: ["address", "road"],
    });

    expect(result[0]?.fullAddress).toBe("12 Main Road, Sea Point, Cape Town");
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.hostname).toBe("api.maptiler.com");
    expect(requestUrl.searchParams.get("country")).toBe("za");
    expect(requestUrl.searchParams.get("bbox")).toBe("18.3,-34.1,18.7,-33.7");
    expect(requestUrl.searchParams.get("proximity")).toBe("18.42,-33.92");
    expect(requestUrl.searchParams.get("types")).toBe("address,road");
  });

  it("passes cancellation through reverse geocoding", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      return Promise.resolve({
        ok: true,
        json: async () => ({ type: "FeatureCollection", features: [], query: [], attribution: "MapTiler" }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await reverseGeocode({
      apiKey: "public-key",
      coordinates: { lat: -33.92, lng: 18.42 },
      signal: controller.signal,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
