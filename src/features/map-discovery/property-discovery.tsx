import type { SwipeFeedMode } from "@/features/swipe-feed/feature-flag";

import { DiscoveryPage } from "./discovery-page";
export function PropertyDiscovery({ mapApiKey, swipeFeedMode }: { mapApiKey?: string; swipeFeedMode?: SwipeFeedMode }) {
  return <DiscoveryPage mapApiKey={mapApiKey} swipeFeedMode={swipeFeedMode} />;
}
