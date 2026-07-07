import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell, BackLink, PageHeader } from "@/components/premium/primitives";
import { ListingForm } from "@/features/listings/listing-form";
import { getListingImages, getMyListing } from "@/features/listings/actions";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Edit Listing | Pinpoints",
  description: "Edit your rental listing on Pinpoints.",
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

  if (!listing.success || !listing.data) redirect("/dashboard");

  const imageData = images.success ? images.data : [];

  return (
    <AppShell width="md" className="pt-2 md:pt-20">
      <BackLink href="/dashboard">Dashboard</BackLink>
      <PageHeader
        eyebrow="Listing management"
        title="Edit listing"
        description="Keep the listing complete and photo-led before publishing."
      />
      <ListingForm
        mode="edit"
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
        listingStatus={listing.data.status}
        defaultImages={imageData}
        defaultMetadata={{
          amenities: (listing.data.metadata as Record<string, unknown>)?.amenities as
            | undefined
            | import("@/features/listings/schema").AmenitiesData,
        }}
        defaultValues={{
          id: listing.data.id,
          title: listing.data.title,
          price: listing.data.price,
          address: listing.data.address,
          latitude: Number(listing.data.latitude),
          longitude: Number(listing.data.longitude),
          bedrooms: Number(listing.data.bedrooms),
          bathrooms: Number(listing.data.bathrooms),
          parking_type: listing.data.parking_type as "none" | "covered" | "uncovered" | "garage",
          parking_count: listing.data.parking_count,
          electricity_type: listing.data.electricity_type as "prepaid" | "conventional" | "solar" | "none",
          water_availability: listing.data.water_availability as "municipal" | "borehole" | "both" | "none",
          electricity_included: listing.data.electricity_included,
          electricity_estimate: listing.data.electricity_estimate,
          water_included: listing.data.water_included,
          water_estimate: listing.data.water_estimate,
          wifi_available: listing.data.wifi_available,
          wifi_included: listing.data.wifi_included,
          wifi_estimate: listing.data.wifi_estimate,
          parking_included: listing.data.parking_included,
          parking_estimate: listing.data.parking_estimate,
          security_fee_estimate: listing.data.security_fee_estimate,
          lease_duration: listing.data.lease_duration as "month_to_month" | "6_months" | "12_months" | "24_months",
          availability_date: listing.data.availability_date,
          description: listing.data.description ?? undefined,
          property_type: listing.data.property_type
            ? (listing.data.property_type as
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
