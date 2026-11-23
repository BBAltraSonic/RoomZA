import { DiscoveryPageFallback } from "@/features/map-discovery/discovery-page-fallback";
import { LoadingHandoff } from "@/lib/motion/provider";

/** A listing opens over the map, so its loader is the same frame the page suspends into. */
export default function ListingLoading() {
  return (
    <LoadingHandoff>
      <DiscoveryPageFallback />
    </LoadingHandoff>
  );
}
