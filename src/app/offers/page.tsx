import type { Metadata } from "next";
import { Suspense } from "react";
import { OffersDiscovery } from "./offers-discovery";
import { DiscoveryPageFallback } from "@/features/map-discovery/discovery-page-fallback";
export const metadata: Metadata = { title: "Specials", description: "Find approved shopping, Tourism and Event Specials near your selected location.", robots: { index: false, follow: false } };
export default function OffersPage() {
  return <Suspense fallback={<DiscoveryPageFallback />}><OffersDiscovery mapApiKey={process.env.NEXT_PUBLIC_MAPTILER_API_KEY} /></Suspense>;
}
