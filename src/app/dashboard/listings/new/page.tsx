import type { Metadata } from "next";

import { requireRole } from "@/lib/auth";
import { ListingForm } from "@/features/listings/listing-form";

export const metadata: Metadata = {
    title: "New Listing — RoomZA",
    description: "Create a new rental listing on RoomZA.",
};

export default async function NewListingPage() {
    await requireRole("landlord");

    return (
        <main className="min-h-screen bg-background px-4 py-8 text-foreground">
            <div className="mx-auto max-w-2xl">
                <p className="text-sm font-medium text-[#b86f42]">Listing management</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-normal">Create new listing</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Fill in the property details below. Your listing will be saved as a draft.
                </p>

                <div className="mt-8">
                    <ListingForm mode="create" googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} />
                </div>
            </div>
        </main>
    );
}
