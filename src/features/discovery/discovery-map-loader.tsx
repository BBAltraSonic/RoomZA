"use client";
import dynamic from "next/dynamic";
import type { DiscoveryMapProps } from "./discovery-map";
const DiscoveryMap = dynamic(
  () => import("./discovery-map").then((module) => module.DiscoveryMap),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        Loading map…
      </p>
    ),
  },
);
export function DiscoveryMapLoader(props: DiscoveryMapProps) {
  return <DiscoveryMap {...props} />;
}
