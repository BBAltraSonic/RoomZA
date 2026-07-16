import type { Metadata } from "next";
import { Suspense } from "react";

import { getPublishedListing } from "@/features/listings/actions";
import { DiscoveryPage } from "@/features/map-discovery/discovery-page";
import { DiscoveryPageFallback } from "@/features/map-discovery/discovery-page-fallback";

type ListingPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ intent?: string }>;
};

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await getPublishedListing(id, { trackView: false });

  if (!listing) {
    return {
      title: "Listing Unavailable | Pinpoints",
      description: "This listing is no longer available.",
    };
  }

  const isSale = listing.listing_type === "sale";
  const displayPrice = isSale ? listing.sale_price ?? listing.price : listing.price;
  const price = `R ${new Intl.NumberFormat("en-ZA").format(displayPrice)}`;

  return {
    title: `${listing.title} | ${price}${isSale ? "" : "/mo"} | Pinpoints`,
    description: `${listing.bedrooms} bed, ${listing.bathrooms} bath ${isSale ? "property for sale" : "rental"} in ${listing.address}. ${price}${isSale ? "" : " per month"} on Pinpoints.`,
    openGraph: {
      title: `${listing.title} | ${price}${isSale ? "" : "/mo"}`,
      description: `${listing.bedrooms} bed, ${listing.bathrooms} bath ${isSale ? "property for sale" : "rental"} in ${listing.address}.`,
      images: listing.images[0]?.public_url ? [listing.images[0].public_url] : [],
    },
  };
}

export default async function ListingPage({ params, searchParams }: ListingPageProps) {
  const { id } = await params;
  const intent = (await searchParams)?.intent;
  const listing = await getPublishedListing(id, { trackView: true });

  const initialListing = listing
    ? {
        id: listing.id,
        title: listing.title,
        address: listing.address,
        price: listing.price,
        sale_price: listing.sale_price,
        display_price: listing.listing_type === "sale" ? listing.sale_price ?? listing.price : listing.price,
        listing_type: listing.listing_type ?? "rent",
        latitude: Number(listing.latitude),
        longitude: Number(listing.longitude),
        bedrooms: Number(listing.bedrooms),
        bathrooms: Number(listing.bathrooms),
        parking_type: listing.parking_type,
        parking_count: listing.parking_count,
        electricity_type: listing.electricity_type,
        water_availability: listing.water_availability,
        property_type: listing.property_type,
        electricity_included: listing.electricity_included,
        electricity_estimate: listing.electricity_estimate,
        water_included: listing.water_included,
        water_estimate: listing.water_estimate,
        wifi_available: listing.wifi_available,
        wifi_included: listing.wifi_included,
        wifi_estimate: listing.wifi_estimate,
        parking_included: listing.parking_included,
        parking_estimate: listing.parking_estimate,
        security_fee_estimate: listing.security_fee_estimate,
        lease_duration: listing.lease_duration,
        availability_date: listing.availability_date,
        created_at: listing.created_at,
        metadata: listing.metadata as { amenities?: import("@/features/listings/schema").AmenitiesData } | null,
        images: listing.images,
      }
    : null;

  return (
    <Suspense fallback={<DiscoveryPageFallback />}>
      <DiscoveryPage
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
        initialListing={initialListing}
        initialIntent={intent === "apply" || intent === "message" ? intent : undefined}
      />
    </Suspense>
  );
}
