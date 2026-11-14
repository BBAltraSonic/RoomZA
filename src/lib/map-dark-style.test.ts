// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { StyleSpecification } from "maplibre-gl";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DARK_MAP_PALETTE,
  loadDarkMapStyle,
  resetDarkMapStyleCache,
  restyleDarkMap,
  useMapTilerStyle,
} from "./map-dark-style";

function fixtureStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      { id: "Background", type: "background", paint: { "background-color": "hsl(60, 6%, 16%)" } },
      { id: "Water", type: "fill", source: "planet", "source-layer": "water", paint: { "fill-color": "hsl(205, 25%, 23%)" } },
      { id: "Building", type: "fill", source: "planet", "source-layer": "building", paint: { "fill-color": "hsl(50, 9%, 13%)", "fill-opacity": 1 } },
      { id: "Road network", type: "line", source: "planet", "source-layer": "road", paint: { "line-color": "hsl(0, 0%, 5%)", "line-width": 2 } },
      {
        id: "Road labels",
        type: "symbol",
        source: "planet",
        "source-layer": "road_label",
        layout: { "text-transform": "uppercase", "text-field": "{name}" },
        paint: { "text-color": "hsl(0, 0%, 73%)", "text-halo-color": "hsl(0, 0%, 9%)" },
      },
      { id: "Custom", type: "fill", source: "planet", "source-layer": "something_new", paint: { "fill-color": "red" } },
    ],
  };
}

const layer = (style: StyleSpecification, id: string) => style.layers.find((entry) => entry.id === id)!;

afterEach(() => {
  resetDarkMapStyleCache();
  vi.unstubAllGlobals();
});

describe("restyleDarkMap", () => {
  it("should_paint_land_in_the_neutral_charcoal_tone", () => {
    const style = restyleDarkMap(fixtureStyle());
    expect(layer(style, "Background").paint).toMatchObject({ "background-color": DARK_MAP_PALETTE.land });
  });

  it("should_draw_roads_lighter_than_the_land_beneath_them", () => {
    const style = restyleDarkMap(fixtureStyle());
    const roadColor = (layer(style, "Road network").paint as Record<string, unknown>)["line-color"];
    expect(roadColor).toEqual([
      "match",
      ["get", "class"],
      ["motorway", "trunk"],
      DARK_MAP_PALETTE.roadMajor,
      ["primary", "secondary"],
      DARK_MAP_PALETTE.roadMedium,
      DARK_MAP_PALETTE.roadMinor,
    ]);
    // Width and other paint properties survive untouched.
    expect((layer(style, "Road network").paint as Record<string, unknown>)["line-width"]).toBe(2);
  });

  it("should_tint_water_and_lift_buildings_off_the_land", () => {
    const style = restyleDarkMap(fixtureStyle());
    expect(layer(style, "Water").paint).toMatchObject({ "fill-color": DARK_MAP_PALETTE.water });
    expect(layer(style, "Building").paint).toMatchObject({
      "fill-color": DARK_MAP_PALETTE.building,
      "fill-outline-color": DARK_MAP_PALETTE.buildingOutline,
      "fill-opacity": 1,
    });
  });

  it("should_set_street_names_in_light_mixed_case_text", () => {
    const style = restyleDarkMap(fixtureStyle());
    const roadLabels = layer(style, "Road labels");
    expect(roadLabels.paint).toMatchObject({
      "text-color": DARK_MAP_PALETTE.label,
      "text-halo-color": DARK_MAP_PALETTE.labelHalo,
    });
    expect(roadLabels.layout).toMatchObject({ "text-transform": "none", "text-letter-spacing": 0, "text-field": "{name}" });
  });

  it("should_leave_unknown_layers_and_the_input_style_unchanged", () => {
    const input = fixtureStyle();
    const snapshot = structuredClone(input);
    const style = restyleDarkMap(input);
    expect(input).toEqual(snapshot);
    expect(layer(style, "Custom")).toEqual(layer(snapshot, "Custom"));
  });
});

describe("loadDarkMapStyle", () => {
  it("should_fetch_each_style_once_and_return_the_restyled_copy", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(fixtureStyle()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([loadDarkMapStyle("https://style/a"), loadDarkMapStyle("https://style/a")]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(layer(first, "Background").paint).toMatchObject({ "background-color": DARK_MAP_PALETTE.land });
  });

  it("should_reject_and_allow_a_retry_when_the_style_request_fails", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadDarkMapStyle("https://style/b")).rejects.toThrow("403");
    await expect(loadDarkMapStyle("https://style/b")).rejects.toThrow("403");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("useMapTilerStyle", () => {
  it("should_return_nothing_without_an_api_key", () => {
    const { result } = renderHook(() => useMapTilerStyle(undefined, true));
    expect(result.current).toBeNull();
  });

  it("should_use_the_light_style_url_directly", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useMapTilerStyle("key", false));
    expect(result.current).toBe("https://api.maptiler.com/maps/base-v4-light/style.json?key=key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should_hold_the_map_until_the_restyled_dark_style_is_ready", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(fixtureStyle()), { status: 200 })));
    const { result } = renderHook(() => useMapTilerStyle("key", true));

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(typeof result.current).toBe("object");
    expect(layer(result.current as StyleSpecification, "Background").paint)
      .toMatchObject({ "background-color": DARK_MAP_PALETTE.land });
  });

  it("should_fall_back_to_the_stock_dark_style_when_the_fetch_fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    const { result } = renderHook(() => useMapTilerStyle("key", true));

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toBe("https://api.maptiler.com/maps/base-v4-dark/style.json?key=key");
  });

  it("should_reuse_a_loaded_dark_style_on_the_next_mount_without_waiting", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(fixtureStyle()), { status: 200 })));
    const first = renderHook(() => useMapTilerStyle("key", true));
    await waitFor(() => expect(first.result.current).not.toBeNull());
    first.unmount();

    let second!: ReturnType<typeof renderHook<ReturnType<typeof useMapTilerStyle>, unknown>>;
    act(() => {
      second = renderHook(() => useMapTilerStyle("key", true));
    });
    expect(second.result.current).toBe(first.result.current);
  });
});
