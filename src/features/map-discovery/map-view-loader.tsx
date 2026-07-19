"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";

import { MapLoadingSkeleton } from "./discovery-loading";
import type { MapViewProps } from "./map-view";

function MapViewLoading() {
  return <MapLoadingSkeleton />;
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
