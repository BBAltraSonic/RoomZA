import { describe, expect, it } from "vitest";

import { boundsFromPoints, createRadiusFeature, toMapBounds } from "./map-geometry";

describe("map geometry adapters", () => {
  it("converts named bounds to longitude-latitude corner ordering", () => {
    expect(toMapBounds({
      west: 18.3,
      south: -34.1,
      east: 18.7,
      north: -33.7,
    })).toEqual([[18.3, -34.1], [18.7, -33.7]]);
  });

  it("derives bounds without swapping latitude and longitude", () => {
    expect(boundsFromPoints([
      { lng: 28.2, lat: -26.3 },
      { lng: 18.4, lat: -33.9 },
      { lng: 25.5, lat: -29.1 },
    ])).toEqual({
      west: 18.4,
      south: -33.9,
      east: 28.2,
      north: -26.3,
    });
  });

  it("builds a closed geodesic 800 metre radius polygon", () => {
    const feature = createRadiusFeature({ lng: 18.4241, lat: -33.9249 }, 800, 32);
    const ring = feature.geometry.coordinates[0]!;

    expect(feature.properties).toEqual({ radiusMetres: 800 });
    expect(ring).toHaveLength(33);
    expect(ring[0]).toEqual(ring.at(-1));

    const northPoint = ring[0]!;
    const latitudeDistanceMetres = Math.abs(northPoint[1]! - (-33.9249)) * 111_320;
    expect(latitudeDistanceMetres).toBeCloseTo(800, -1);
  });
});
