"use client";

import { useMemo } from "react";
import Map, { Layer, Source } from "react-map-gl/maplibre";
import mapLibrePackage from "maplibre-gl/package.json";

import { getMapTilerStyleUrl } from "@/lib/maptiler";

import type { CanonicalImportListing } from "./types";

export function ImportPreviewMap({
  rows,
  mapApiKey,
}: {
  rows: Array<{ id: string; normalized_data: CanonicalImportListing }>;
  mapApiKey?: string;
}) {

  const geojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: rows.flatMap((row) => {
      const { longitude, latitude, title } = row.normalized_data;
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return [];
      return [{
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [longitude!, latitude!] },
        properties: { id: row.id, title: title ?? "Untitled" },
      }];
    }),
  }), [rows]);

  if (!mapApiKey) {
    return (
      <div className="flex min-h-96 items-center justify-center bg-muted p-6 text-center text-sm text-muted-foreground">
        The MapTiler preview needs a configured public API key.
      </div>
    );
  }

  return (
    <div className="min-h-96 overflow-hidden rounded-lg border border-border">
      <Map
        initialViewState={{ longitude: 24.5, latitude: -29, zoom: 4.5 }}
        mapStyle={getMapTilerStyleUrl(mapApiKey, true)}
        workerUrl={`/maplibre/${mapLibrePackage.version}/maplibre-gl-worker.mjs`}
        attributionControl={{ compact: true }}
        dragRotate={false}
        style={{ width: "100%", minHeight: 384 }}
      >
        <Source id="import-preview" type="geojson" data={geojson} cluster clusterRadius={58} clusterMaxZoom={13}>
          <Layer
            id="import-clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": "#D89B23",
              "circle-radius": ["step", ["get", "point_count"], 18, 100, 24, 1000, 31],
              "circle-stroke-color": "#151A24",
              "circle-stroke-width": 2,
            }}
          />
          <Layer
            id="import-cluster-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{ "text-field": ["get", "point_count_abbreviated"], "text-size": 12 }}
            paint={{ "text-color": "#151A24" }}
          />
          <Layer
            id="import-points"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": "#D89B23",
              "circle-radius": 7,
              "circle-stroke-color": "#151A24",
              "circle-stroke-width": 2,
            }}
          />
        </Source>
      </Map>
    </div>
  );
}
