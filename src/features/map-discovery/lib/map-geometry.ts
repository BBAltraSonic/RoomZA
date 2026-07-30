import type { Feature, Polygon } from "geojson";

import type { GeoPoint, ViewportBounds } from "./types";

const EARTH_RADIUS_METRES = 6_371_008.8;

export function toMapBounds(bounds: ViewportBounds): [[number, number], [number, number]] {
  return [
    [bounds.west, bounds.south],
    [bounds.east, bounds.north],
  ];
}

export function boundsFromPoints(points: GeoPoint[]): ViewportBounds | null {
  if (points.length === 0) return null;

  return points.reduce<ViewportBounds>(
    (bounds, point) => ({
      west: Math.min(bounds.west, point.lng),
      south: Math.min(bounds.south, point.lat),
      east: Math.max(bounds.east, point.lng),
      north: Math.max(bounds.north, point.lat),
    }),
    {
      west: points[0]!.lng,
      south: points[0]!.lat,
      east: points[0]!.lng,
      north: points[0]!.lat,
    },
  );
}

export function createRadiusFeature(
  center: GeoPoint,
  radiusMetres: number,
  steps = 64,
): Feature<Polygon> {
  const angularDistance = radiusMetres / EARTH_RADIUS_METRES;
  const latitude = center.lat * Math.PI / 180;
  const longitude = center.lng * Math.PI / 180;
  const coordinates: [number, number][] = [];

  for (let step = 0; step <= steps; step += 1) {
    const bearing = (step / steps) * Math.PI * 2;
    const pointLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const pointLongitude = longitude + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(pointLatitude),
    );
    coordinates.push([
      pointLongitude * 180 / Math.PI,
      pointLatitude * 180 / Math.PI,
    ]);
  }

  return {
    type: "Feature",
    properties: { radiusMetres },
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
  };
}
