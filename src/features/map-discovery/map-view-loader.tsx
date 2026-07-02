"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { useRef } from "react";

import type { MapViewProps } from "./map-view";

function MapViewLoading() {
  return (
    <div className="relative flex h-full min-h-[520px] items-center justify-center bg-muted">
      <div className="flex flex-col items-center rounded-lg border border-border bg-panel p-5 text-center shadow-[var(--elevation-2)]">
        <div className="flex size-11 items-center justify-center rounded-md bg-warm-surface text-forest">
          <MapPin className="size-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-ink">Loading map</p>
        <p className="mt-1 text-sm text-muted-foreground">Listings will stream in as soon as the map is ready.</p>
      </div>
    </div>
  );
}

const DynamicMapView = dynamic<MapViewProps>(
  () => import("./map-view").then((module) => module.MapView),
  {
    ssr: false,
    loading: MapViewLoading,
  },
);

export function MapViewLoader(props: MapViewProps) {
  const loaderRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={loaderRef} className="contents">
      <DynamicMapView {...props} />
    </div>
  );
}
