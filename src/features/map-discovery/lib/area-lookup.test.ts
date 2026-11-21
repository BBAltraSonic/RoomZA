import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { areaLookupKey, lookupAreaFeature, resetAreaLookupCache } from "./area-lookup";

const payload = {
  features: [{
    id: "neighbourhood.rondebosch", text: "Rondebosch", place_name: "Rondebosch, Cape Town, South Africa",
    center: [18.47, -33.96], place_type: ["neighbourhood"], properties: {},
    context: [{ id: "municipal_district.ward-58", text: "Cape Town Ward 58" }, { id: "place.cape-town", text: "Cape Town" }],
  }],
};

beforeEach(() => {
  resetAreaLookupCache();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
});
afterEach(() => vi.unstubAllGlobals());

describe("lookupAreaFeature", () => {
  it("treats small pans as the same area and wider moves as a new one", () => {
    const here = { lat: -33.9601, lng: 18.4702 };
    expect(areaLookupKey({ lat: -33.9603, lng: 18.4704 }, 15)).toBe(areaLookupKey(here, 15));
    expect(areaLookupKey({ lat: -33.98, lng: 18.47 }, 15)).not.toBe(areaLookupKey(here, 15));
    // Zooming out to a coarser label is a different question, even at the same centre.
    expect(areaLookupKey(here, 9)).not.toBe(areaLookupKey(here, 15));
  });

  it("asks the geocoder once per area and shares requests in flight", async () => {
    const center = { lat: -33.96, lng: 18.47 };
    const [first, second] = await Promise.all([
      lookupAreaFeature({ apiKey: "key", center, zoom: 15 }),
      lookupAreaFeature({ apiKey: "key", center: { lat: -33.9601, lng: 18.4701 }, zoom: 15 }),
    ]);
    await lookupAreaFeature({ apiKey: "key", center, zoom: 15.4 });
    expect(first?.label).toBe("Rondebosch");
    expect(second).toBe(first);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("lets a superseded caller stop waiting without cancelling the shared request", async () => {
    const controller = new AbortController();
    const center = { lat: -33.96, lng: 18.47 };
    const abandoned = lookupAreaFeature({ apiKey: "key", center, zoom: 15, signal: controller.signal });
    controller.abort();
    await expect(abandoned).rejects.toMatchObject({ name: "AbortError" });
    await expect(lookupAreaFeature({ apiKey: "key", center, zoom: 15 })).resolves.toMatchObject({ label: "Rondebosch" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
