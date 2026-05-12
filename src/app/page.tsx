import type { Metadata } from "next";
import { Suspense } from "react";

import { DiscoveryPage } from "@/features/map-discovery/discovery-page";

export const metadata: Metadata = {
  title: "Browse Rentals on the Map",
  description:
    "Explore rental listings across South Africa on an interactive map. Filter by area, price, and amenities to find your next home.",
  openGraph: {
    title: "Browse Rentals on the Map — RoomZA",
    description:
      "Explore rental listings across South Africa on an interactive map.",
  },
};

export default function Home() {
  return (
    <Suspense fallback={null}>
      <DiscoveryPage googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} />
    </Suspense>
  );
}
