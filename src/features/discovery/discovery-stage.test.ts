import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StageLayer } from "./discovery-stage";

const layer = (areaId: string | null, environment: StageLayer["environment"] = "shopping"): StageLayer =>
  environment === "property" ? { kind: "property", environment, areaId, props: {} as never } : { kind: "points", environment, areaId, props: {} as never };
const camera = { lng: 21.9, lat: -29.5, zoom: 7 };

// The remembered camera is module state, so each test starts from a fresh module.
async function freshStore() {
  vi.resetModules();
  const { createStageStore } = await import("./discovery-stage");
  return createStageStore;
}

describe("stage camera", () => {
  let createStageStore: Awaited<ReturnType<typeof freshStore>>;
  beforeEach(async () => { createStageStore = await freshStore(); });

  it("should resume the camera for a map that shows the same area", () => {
    const store = createStageStore();
    store.setLayer(layer("area-a"));
    store.setCamera(camera);
    expect(store.getCamera("area-a")).toEqual(camera);
  });

  it("should not resume a camera from another area, so the map moves to the chosen location", () => {
    const store = createStageStore();
    store.setLayer(layer("area-a"));
    store.setCamera(camera);
    expect(store.getCamera("area-b")).toBeNull();
    expect(store.getCamera(null)).toBeNull();
  });

  it("should not resume an area's camera after leaving discovery and returning to a different area", () => {
    const first = createStageStore();
    first.setLayer(layer("area-a"));
    first.setCamera(camera);
    const returning = createStageStore();
    expect(returning.getCamera("area-a")).toEqual(camera);
    expect(returning.getCamera("area-b")).toBeNull();
  });

  it("should treat a change of area alone as a new layer", () => {
    const store = createStageStore(), listener = vi.fn();
    const props = {} as never;
    store.subscribe(listener);
    store.setLayer({ kind: "points", environment: "shopping", areaId: "area-a", props });
    store.setLayer({ kind: "points", environment: "shopping", areaId: "area-b", props });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("should count an arrival each time the visitor switches to another environment", () => {
    const store = createStageStore();
    store.setLayer(layer("area-a", "property"));
    expect(store.getArrivals()).toBe(0);
    store.setLayer(layer("area-a", "shopping"));
    store.setLayer(layer("area-a", "service"));
    expect(store.getArrivals()).toBe(2);
  });

  it("should not count an arrival when the same environment changes area or refreshes", () => {
    const store = createStageStore();
    store.setLayer(layer("area-a", "event"));
    store.setLayer(layer("area-b", "event"));
    store.setLayer({ ...layer("area-b", "event"), props: { points: [] } as never });
    expect(store.getArrivals()).toBe(0);
  });
});
