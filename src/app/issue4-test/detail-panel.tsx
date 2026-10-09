"use client";

import dynamic from "next/dynamic";
import type { ListingDetail } from "@/features/map-discovery/listing-detail-panel";

const DetailPanel = dynamic(() => import("@/features/map-discovery/listing-detail-panel")
  .then((module) => module.ListingDetailPanel), { ssr: false });

export function Issue4DetailPanel({ listing }: { listing: ListingDetail }) {
  return <DetailPanel listing={listing} />;
}
