import { describe, expect, it, vi } from "vitest";

import { MAP_INTRO_DURATION_MS, boundsAtCamera, cameraLandedAt, introEasing, introStartZoom, locateFlight, shouldPlayMapIntro, whooshToBounds } from "./map-intro";

describe("map intro", () => {
  it("starts six zoom levels out, never past a whole-world view", () => {
    expect(introStartZoom(11)).toBe(5);
    expect(introStartZoom(14)).toBe(8);
    expect(introStartZoom(4)).toBe(2);
  });

  it("rushes in first and lands exactly", () => {
    expect(introEasing(0)).toBe(0);
    expect(introEasing(1)).toBe(1);
    expect(introEasing(0.125)).toBeCloseTo(0.5, 2);
    for (let t = 0.05; t <= 1; t += 0.05) expect(introEasing(t)).toBeGreaterThan(introEasing(t - 0.05));
  });

  it("only plays for a visible tab that has not seen it and allows motion", () => {
    expect(shouldPlayMapIntro({ reducedMotion: false, hidden: false, alreadyPlayed: false })).toBe(true);
    expect(shouldPlayMapIntro({ reducedMotion: true, hidden: false, alreadyPlayed: false })).toBe(false);
    expect(shouldPlayMapIntro({ reducedMotion: false, hidden: true, alreadyPlayed: false })).toBe(false);
    expect(shouldPlayMapIntro({ reducedMotion: false, hidden: false, alreadyPlayed: true })).toBe(false);
  });

  it("knows the whole world fits one 512px tile at zoom 0", () => {
    const world = boundsAtCamera({ lng: 0, lat: 0, zoom: 0 }, { width: 512, height: 512 });
    expect(world.west).toBeCloseTo(-180);
    expect(world.east).toBeCloseTo(180);
    expect(world.north).toBeCloseTo(85.0511, 3);
    expect(world.south).toBeCloseTo(-85.0511, 3);
  });

  it("frames a city view around its centre, with fewer degrees per pixel toward the pole", () => {
    const view = boundsAtCamera({ lng: 28.0473, lat: -26.2041, zoom: 11 }, { width: 400, height: 800 });
    // 400px at zoom 11 spans 400 / (512 * 2^11) of the world's 360 degrees.
    expect(view.east - view.west).toBeCloseTo((400 / (512 * 2 ** 11)) * 360, 6);
    expect((view.east + view.west) / 2).toBeCloseTo(28.0473, 6);
    expect(view.north).toBeGreaterThan(-26.2041);
    expect(view.south).toBeLessThan(-26.2041);
    // Johannesburg is south of the equator, so the southern half spans less latitude.
    expect(-26.2041 - view.south).toBeLessThan(view.north - -26.2041);
  });

  it("only counts a camera that reached its target as landed", () => {
    const target = { lng: 28.0473, lat: -26.2041, zoom: 11 };
    expect(cameraLandedAt({ ...target }, target)).toBe(true);
    expect(cameraLandedAt({ ...target, zoom: 9.4 }, target)).toBe(false);
    expect(cameraLandedAt({ ...target, lng: 28.1 }, target)).toBe(false);
  });

  it("flies to the visitor with the same whoosh: pulls back six levels, then dives in", () => {
    expect(locateFlight({ lat: -26, lng: 28 }, false)).toEqual({
      center: [28, -26],
      zoom: 15,
      minZoom: 9,
      duration: MAP_INTRO_DURATION_MS,
      easing: introEasing,
    });
  });

  it("jumps straight to the visitor when motion is reduced", () => {
    expect(locateFlight({ lat: -26, lng: 28 }, true)).toEqual({ center: [28, -26], zoom: 15, duration: 0 });
  });

  describe("whooshToBounds", () => {
    const area = { west: 27.9, south: -26.3, east: 28.1, north: -26.1 };
    const fakeMap = (camera: { center: { lng: number; lat: number }; zoom: number } | undefined) => ({
      cameraForBounds: vi.fn(() => camera), flyTo: vi.fn(), fitBounds: vi.fn(),
    });

    it("flies onto the area with the whoosh, pulling back six levels from where it lands", () => {
      const map = fakeMap({ center: { lng: 28, lat: -26.2 }, zoom: 12 });
      whooshToBounds(map, area, 40, false);
      expect(map.cameraForBounds).toHaveBeenCalledWith([[27.9, -26.3], [28.1, -26.1]], { padding: 40 });
      expect(map.flyTo).toHaveBeenCalledWith({ center: { lng: 28, lat: -26.2 }, zoom: 12, minZoom: 6, duration: MAP_INTRO_DURATION_MS, easing: introEasing });
      expect(map.fitBounds).not.toHaveBeenCalled();
    });

    it("jumps onto the area when motion is reduced", () => {
      const map = fakeMap({ center: { lng: 28, lat: -26.2 }, zoom: 12 });
      whooshToBounds(map, area, 0, true);
      expect(map.flyTo).toHaveBeenCalledWith({ center: { lng: 28, lat: -26.2 }, zoom: 12, duration: 0 });
    });

    it("falls back to fitting the area when no camera can frame it", () => {
      const map = fakeMap(undefined);
      whooshToBounds(map, area, 40, false);
      expect(map.flyTo).not.toHaveBeenCalled();
      expect(map.fitBounds).toHaveBeenCalledWith([[27.9, -26.3], [28.1, -26.1]], { padding: 40, duration: MAP_INTRO_DURATION_MS });
    });
  });
});
