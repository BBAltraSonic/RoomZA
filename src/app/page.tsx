import type { Metadata } from "next";
import { Suspense } from "react";

import { getLatestPublishedBlogPosts } from "@/features/blog/data";
import { DiscoveryPage } from "@/features/map-discovery/discovery-page";
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

export default async function Home() {
  const initialBlogPosts = await getLatestPublishedBlogPosts(3).catch(() => []);
  return (
    <Suspense fallback={<DiscoveryPageFallback />}>
      <DiscoveryPage
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
        initialBlogPosts={initialBlogPosts}
      />
    </Suspense>
  );
}
