import type { Metadata } from "next";
import { Suspense } from "react";

import { DiscoveryPage } from "@/features/map-discovery/discovery-page";
import { getSessionProfile } from "@/lib/auth";
import { isRole } from "@/lib/roles";

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

export default async function Home() {
  const { user, profile } = await getSessionProfile();
  const currentRole = isRole(profile?.role) ? profile.role : null;

  return (
    <Suspense fallback={null}>
      <DiscoveryPage googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} currentRole={currentRole} isAuthenticated={Boolean(user)} />
    </Suspense>
  );
}
