import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell, PageHeader } from "@/components/premium/primitives";
import { ListingForm } from "@/features/listings/listing-form";
import { getListingImages, getMyListing } from "@/features/listings/actions";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Edit Listing | RoomZA",
  description: "Edit your rental listing on RoomZA.",
};

type EditListingPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditListingPage({ params }: EditListingPageProps) {
  const { id } = await params;
  await requireRole("landlord", { redirectTo: `/dashboard/listings/${id}/edit` });
  const [listing, images] = await Promise.all([
    getMyListing(id),
    getListingImages(id),
  ]);

  if (!listing) redirect("/dashboard");

  return (
    <AppShell width="md" className="pt-2 md:pt-20">
      <PageHeader
        eyebrow="Listing management"
        title="Edit listing"
        description="Keep the listing complete and photo-led before publishing."
      />
      <ListingForm
        mode="edit"
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
        listingStatus={listing.status}
        defaultImages={images}
        defaultMetadata={{
          amenities: (listing.metadata as Record<string, unknown>)?.amenities as
            | undefined
            | import("@/features/listings/schema").AmenitiesData,
        }}
        defaultValues={{
          id: listing.id,
          title: listing.title,
          price: listing.price,
          address: listing.address,
          latitude: Number(listing.latitude),
          longitude: Number(listing.longitude),
          bedrooms: Number(listing.bedrooms),
          bathrooms: Number(listing.bathrooms),
          parking_type: listing.parking_type as "none" | "covered" | "uncovered" | "garage",
          parking_count: listing.parking_count,
          electricity_type: listing.electricity_type as "prepaid" | "conventional" | "solar" | "none",
          water_availability: listing.water_availability as "municipal" | "borehole" | "both" | "none",
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
          lease_duration: listing.lease_duration as "month_to_month" | "6_months" | "12_months" | "24_months",
          availability_date: listing.availability_date,
          description: listing.description ?? undefined,
          property_type: listing.property_type
            ? (listing.property_type as
                | "apartment"
                | "house"
                | "room"
                | "studio"
                | "cottage"
                | "townhouse")
            : undefined,
        }}
      />
    </AppShell>
  );
}
