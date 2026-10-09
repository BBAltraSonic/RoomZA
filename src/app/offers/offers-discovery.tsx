"use client";
import { useDiscoverySearchParams } from "@/features/discovery/use-discovery-search-params";
import { ViewportDiscoveryScreen } from "@/features/discovery/viewport-discovery-screen";
export function OffersDiscovery({ mapApiKey }: { mapApiKey?: string }) {
  const params = useDiscoverySearchParams();
  const kind = params.get("kind");
  const category = kind === "tourism" || kind === "event" ? kind : "shopping";
  return <ViewportDiscoveryScreen key={category} category={category} mapApiKey={mapApiKey} />;
}
