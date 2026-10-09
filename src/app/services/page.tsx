import type { Metadata } from "next";
import { Suspense } from "react";
import { ServicesUrlDiscovery } from "./services-url-discovery";
import { DiscoveryPageFallback } from "@/features/map-discovery/discovery-page-fallback";
export const metadata: Metadata = { title: "Nearby Services", robots: { index: false, follow: false } };
export default function ServicesPage() {
  return <Suspense fallback={<DiscoveryPageFallback />}><ServicesUrlDiscovery mapApiKey={process.env.NEXT_PUBLIC_MAPTILER_API_KEY} /></Suspense>;
}
