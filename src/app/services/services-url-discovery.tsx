"use client";
import { ViewportDiscoveryScreen } from "@/features/discovery/viewport-discovery-screen";
export function ServicesUrlDiscovery({ mapApiKey }: { mapApiKey?: string }) {
  return <ViewportDiscoveryScreen category="service" mapApiKey={mapApiKey} />;
}
