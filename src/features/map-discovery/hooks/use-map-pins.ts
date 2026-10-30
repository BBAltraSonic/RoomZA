"use client";

import { useCallback, useMemo } from "react";
import Supercluster from "supercluster";

import { paddedBounds, windowMarkers } from "../lib/marker-window";
import type { GeoPoint, ViewportBounds } from "../lib/types";

type Pin = { id: string; coordinates: GeoPoint };
type PinProperties = { pinId: string };

export type MapPinCluster = { clusterId: number; count: number; lng: number; lat: number };

/** Turns every result into the small set of markers worth keeping in the DOM. */
export function useMapPins<T extends Pin>(pins: readonly T[], bounds: ViewportBounds, zoom: number, selectedId?: string) {
  const index = useMemo(() => {
    const next = new Supercluster<PinProperties, Record<string, never>>({ radius: 72, maxZoom: 14 });
    next.load(pins.map(pin => ({
      type: "Feature",
      properties: { pinId: pin.id },
      geometry: { type: "Point", coordinates: [pin.coordinates.lng, pin.coordinates.lat] },
    })));
    return next;
  }, [pins]);

  const { clusters, singles } = useMemo(() => {
    const area = paddedBounds(bounds);
    const clusters: MapPinCluster[] = [];
    const visibleIds = new Set<string>();
    const features = index.getClusters([Math.max(-180, area.west), Math.max(-85, area.south), Math.min(180, area.east), Math.min(85, area.north)], zoom);
    for (const feature of features) {
      const [lng, lat] = feature.geometry.coordinates;
      if (typeof lng !== "number" || typeof lat !== "number") continue;
      if ("cluster" in feature.properties && feature.properties.cluster) {
        clusters.push({ clusterId: Number(feature.properties.cluster_id), count: Number(feature.properties.point_count), lng, lat });
      } else {
        visibleIds.add((feature.properties as PinProperties).pinId);
      }
    }
    const singles = windowMarkers(pins.filter(pin => visibleIds.has(pin.id) || pin.id === selectedId), bounds, { keepIds: [selectedId] });
    return { clusters, singles };
  }, [bounds, index, pins, selectedId, zoom]);

  const clusterMembers = useCallback((clusterId: number) => index.getLeaves(clusterId, Infinity).map(leaf => ({
    id: leaf.properties.pinId,
    lng: leaf.geometry.coordinates[0]!,
    lat: leaf.geometry.coordinates[1]!,
  })), [index]);

  return { clusters, singles, clusterMembers };
}
