import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { getMyListing, getListingImages } from "@/features/listings/actions";
import { ListingForm } from "@/features/listings/listing-form";

export const metadata: Metadata = {
    title: "Edit Listing — RoomZA",
    description: "Edit your rental listing on RoomZA.",
};

type EditListingPageProps = {
    params: Promise<{ id: string }>;
};

export default async function EditListingPage({ params }: EditListingPageProps) {
    await requireRole("landlord");

    const { id } = await params;
    const [listing, images] = await Promise.all([
        getMyListing(id),
        getListingImages(id),
    ]);

    if (!listing) {
        redirect("/dashboard");
    }

    return (
        <main className="min-h-screen bg-background px-4 py-8 text-foreground">
            <div className="mx-auto max-w-2xl">
                <p className="text-sm font-medium text-[#b86f42]">Listing management</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-normal">Edit listing</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Update the property details below.
                </p>

                <div className="mt-8">
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
                            lease_duration: listing.lease_duration as "month_to_month" | "6_months" | "12_months" | "24_months",
                            availability_date: listing.availability_date,
                        }}
                    />
                </div>
            </div>
        </main>
    );
}
