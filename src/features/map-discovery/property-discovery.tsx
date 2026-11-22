"use client";
import { DiscoveryPage } from "./discovery-page";
export function PropertyDiscovery({ mapApiKey }: { mapApiKey?: string }) {
  return <DiscoveryPage mapApiKey={mapApiKey} />;
}
