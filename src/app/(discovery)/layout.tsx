import { Suspense, type ReactNode } from "react";

import { DiscoveryWorkspace } from "@/features/discovery/discovery-workspace";
import { DiscoveryPageFallback } from "@/features/map-discovery/discovery-page-fallback";
import { readSwipeFeedMode } from "@/features/swipe-feed/feature-flag.server";

/** Lives above `/` and `/offers`, so moving between them keeps the map. */
export default function DiscoveryLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<DiscoveryPageFallback />}>
      <DiscoveryWorkspace mapApiKey={process.env.NEXT_PUBLIC_MAPTILER_API_KEY} swipeFeedMode={readSwipeFeedMode()}>{children}</DiscoveryWorkspace>
    </Suspense>
  );
}
