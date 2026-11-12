"use client";

import { useCallback, useMemo } from "react";
import Supercluster from "supercluster";

import { paddedBounds, windowMarkers } from "../lib/marker-window";
import type { GeoPoint, ViewportBounds } from "../lib/types";

type Pin = { id: string; coordinates: GeoPoint };
type PinProperties = { pinId: string; live: boolean; price: number | null };
type ClusterSignals = { liveCount: number; fromPrice: number | null };

/** What a pin contributes to its cluster, so grouping never hides what matters. */
export type PinSignals = { live: boolean; price?: number };

export type MapPinCluster = { clusterId: number; count: number; lng: number; lat: number } & ClusterSignals;

const noSignals = (): PinSignals => ({ live: false });

function lowest(a: number | null, b: number | null) {
  return a === null ? b : b === null ? a : Math.min(a, b);
}

/**
 * Turns every result into the small set of markers worth keeping in the DOM.
 * `signalsOf` must be stable: a new function rebuilds the cluster index.
 */
export function useMapPins<T extends Pin>(pins: readonly T[], bounds: ViewportBounds, zoom: number, selectedId?: string, signalsOf: (pin: T) => PinSignals = noSignals) {
  const index = useMemo(() => {
    const next = new Supercluster<PinProperties, ClusterSignals>({
      radius: 72,
      maxZoom: 14,
      map: ({ live, price }) => ({ liveCount: live ? 1 : 0, fromPrice: price }),
      reduce: (total, signals) => {
        total.liveCount += signals.liveCount;
        total.fromPrice = lowest(total.fromPrice, signals.fromPrice);
      },
    });
    next.load(pins.map(pin => {
      const { live, price } = signalsOf(pin);
      return {
        type: "Feature",
        properties: { pinId: pin.id, live, price: price ?? null },
        geometry: { type: "Point", coordinates: [pin.coordinates.lng, pin.coordinates.lat] },
      };
    }));
    return next;
  }, [pins, signalsOf]);

  const { clusters, singles } = useMemo(() => {
    const area = paddedBounds(bounds);
    const clusters: MapPinCluster[] = [];
    const visibleIds = new Set<string>();
    const features = index.getClusters([Math.max(-180, area.west), Math.max(-85, area.south), Math.min(180, area.east), Math.min(85, area.north)], zoom);
    for (const feature of features) {
      const [lng, lat] = feature.geometry.coordinates;
      if (typeof lng !== "number" || typeof lat !== "number") continue;
      if ("cluster" in feature.properties && feature.properties.cluster) {
        const { cluster_id, point_count, liveCount, fromPrice } = feature.properties;
        clusters.push({ clusterId: Number(cluster_id), count: Number(point_count), lng, lat, liveCount, fromPrice });
      } else {
        visibleIds.add((feature.properties as PinProperties).pinId);
      }
    }
    // Live pins go first so the DOM budget can never drop one for a quieter neighbour.
    const ranked = pins.filter(pin => visibleIds.has(pin.id) || pin.id === selectedId)
      .sort((a, b) => Number(signalsOf(b).live) - Number(signalsOf(a).live));
    const singles = windowMarkers(ranked, bounds, { keepIds: [selectedId] });
    return { clusters, singles };
  }, [bounds, index, pins, selectedId, signalsOf, zoom]);

  const clusterMembers = useCallback((clusterId: number) => index.getLeaves(clusterId, Infinity).map(leaf => ({
    id: leaf.properties.pinId,
    lng: leaf.geometry.coordinates[0]!,
    lat: leaf.geometry.coordinates[1]!,
  })), [index]);

  return { clusters, singles, clusterMembers };
}
