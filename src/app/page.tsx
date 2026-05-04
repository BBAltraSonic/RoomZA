import { DiscoveryPage } from "@/features/map-discovery/discovery-page";

export default function Home() {
  return <DiscoveryPage mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />;
}
