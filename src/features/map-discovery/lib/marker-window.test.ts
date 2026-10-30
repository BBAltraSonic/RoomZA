import { describe, expect, it } from "vitest";
import { MAX_DOM_MARKERS, paddedBounds, windowMarkers, zoomBucket } from "./marker-window";

const bounds = { west: 28, south: -27, east: 29, north: -26 };
const pin = (id: string, lng: number, lat: number) => ({ id, coordinates: { lat, lng } });

describe("marker window", () => {
  it("should skip pins that are well outside the viewport", () => {
    const pins = [pin("in", 28.5, -26.5), pin("out", 31, -26.5)];
    expect(windowMarkers(pins, bounds).map(item => item.id)).toEqual(["in"]);
  });

  it("should keep pins just outside the edge so they do not pop in while panning", () => {
    expect(windowMarkers([pin("edge", 29.1, -26.5)], bounds).map(item => item.id)).toEqual(["edge"]);
  });

  it("should never exceed the DOM marker budget", () => {
    const pins = Array.from({ length: 500 }, (_, index) => pin(String(index), 28.5, -26.5));
    expect(windowMarkers(pins, bounds)).toHaveLength(MAX_DOM_MARKERS);
  });

  it("should always keep the selected pin even when it would be cut by the budget", () => {
    const pins = [...Array.from({ length: 500 }, (_, index) => pin(String(index), 28.5, -26.5)), pin("chosen", 28.6, -26.6)];
    const windowed = windowMarkers(pins, bounds, { keepIds: ["chosen"] });
    expect(windowed).toHaveLength(MAX_DOM_MARKERS);
    expect(windowed.some(item => item.id === "chosen")).toBe(true);
  });

  it("should keep the selected pin even when it is out of view", () => {
    const pins = [pin("in", 28.5, -26.5), pin("chosen", 40, -26.5)];
    expect(windowMarkers(pins, bounds, { keepIds: ["chosen"] }).map(item => item.id).sort()).toEqual(["chosen", "in"]);
  });

  it("should expand bounds by a fraction of the viewport", () => {
    expect(paddedBounds(bounds, 0.5)).toEqual({ west: 27.5, south: -27.5, east: 29.5, north: -25.5 });
  });

  it("should change zoom bucket only when the whole zoom level changes", () => {
    expect(zoomBucket(11.1)).toBe(11);
    expect(zoomBucket(11.9)).toBe(11);
    expect(zoomBucket(12)).toBe(12);
    expect(zoomBucket(-1)).toBe(0);
    expect(zoomBucket(30)).toBe(22);
  });
});
