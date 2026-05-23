import type { Metadata } from "next";
import { Suspense } from "react";

import { getPublishedListing } from "@/features/listings/actions";
import { DiscoveryPage } from "@/features/map-discovery/discovery-page";

type ListingPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await getPublishedListing(id);

  if (!listing) {
    return {
      title: "Listing Unavailable | RoomZA",
      description: "This listing is no longer available.",
    };
  }

  const price = `R ${new Intl.NumberFormat("en-ZA").format(listing.price)}`;

  return {
    title: `${listing.title} | ${price}/mo | RoomZA`,
    description: `${listing.bedrooms} bed, ${listing.bathrooms} bath rental in ${listing.address}. ${price} per month on RoomZA.`,
    openGraph: {
      title: `${listing.title} | ${price}/mo`,
      description: `${listing.bedrooms} bed, ${listing.bathrooms} bath rental in ${listing.address}.`,
      images: listing.images[0]?.public_url ? [listing.images[0].public_url] : [],
    },
  };
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { id } = await params;
  const listing = await getPublishedListing(id);

  const initialListing = listing
    ? {
        id: listing.id,
        title: listing.title,
        address: listing.address,
        price: listing.price,
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
    <Suspense fallback={null}>
      <DiscoveryPage
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
        initialListing={initialListing}
      />
    </Suspense>
  );
}
