import { describe, expect, it } from "vitest";

import { buildQuickFilterCameraPlan, discoveryCameraPadding } from "./quick-filter-camera";

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
      padding: { top: 64, right: 56, bottom: 64, left: 56 },
    });
    expect(buildQuickFilterCameraPlan(many, false, 360)).toMatchObject({
      kind: "bounds",
      padding: { top: 48, right: 40, bottom: 392, left: 40 },
    });
  });

  it("leaves usable map space below the header on short phones", () => {
    const plan = buildQuickFilterCameraPlan(many, false, 240, 268);
    expect(plan).toMatchObject({ kind: "bounds", padding: { top: 48, bottom: 156 } });
    if (plan.kind === "bounds") expect(268 - plan.padding.top - plan.padding.bottom).toBe(64);
  });

  it("keeps padding inside even a very short map pane", () => {
    for (const height of [48, 96, 150, 268]) {
      for (const desktop of [true, false]) {
        const padding = discoveryCameraPadding(desktop, 480, height);
        expect(padding.top + padding.bottom).toBeLessThan(height);
        expect(padding.bottom).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
