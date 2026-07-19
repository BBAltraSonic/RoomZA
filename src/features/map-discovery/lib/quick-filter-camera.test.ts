import { describe, expect, it } from "vitest";

import { buildQuickFilterCameraPlan } from "./quick-filter-camera";

const one = [{ coordinates: { lat: -33.92, lng: 18.42 } }];
const many = [...one, { coordinates: { lat: -33.98, lng: 18.51 } }];

describe("buildQuickFilterCameraPlan", () => {
  it("does not move the camera for an empty filtered collection", () => {
    expect(buildQuickFilterCameraPlan([], false, 320)).toEqual({ kind: "none" });
  });

  it("focuses one match at zoom level 16", () => {
    expect(buildQuickFilterCameraPlan(one, false, 320)).toEqual({
      kind: "single",
      target: one[0]!.coordinates,
      zoom: 16,
    });
  });

  it("fits multiple matches with desktop rail and mobile sheet padding", () => {
    expect(buildQuickFilterCameraPlan(many, true, 0)).toMatchObject({
      kind: "bounds",
      padding: { top: 64, right: 56, bottom: 64, left: 500 },
    });
    expect(buildQuickFilterCameraPlan(many, false, 360)).toMatchObject({
      kind: "bounds",
      padding: { top: 120, right: 40, bottom: 392, left: 40 },
    });
  });
});
