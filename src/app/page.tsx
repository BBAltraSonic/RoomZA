import type { Metadata } from "next";
import { Suspense } from "react";


import { PropertyDiscovery } from "@/features/map-discovery/property-discovery";
import { DiscoveryPageFallback } from "@/features/map-discovery/discovery-page-fallback";

export const metadata: Metadata = {
  title: "Browse Rentals on the Map",
  description:
    "Explore rental listings across South Africa on an interactive map. Filter by area, price, and amenities to find your next home.",
  openGraph: {
    title: "Browse Rentals on the Map — Pinpoints",
    description:
      "Explore rental listings across South Africa on an interactive map.",
  },
};

export default function Home() {
  return (
    <Suspense fallback={<DiscoveryPageFallback />}>
      <PropertyDiscovery
        mapApiKey={process.env.NEXT_PUBLIC_MAPTILER_API_KEY}
      />
    </Suspense>
  );
}
