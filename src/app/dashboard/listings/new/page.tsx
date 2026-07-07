import type { Metadata } from "next";

import { AppShell, BackLink, PageHeader } from "@/components/premium/primitives";
import { ListingForm } from "@/features/listings/listing-form";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "New Listing | Pinpoints",
  description: "Create a new rental listing on Pinpoints.",
};

export default async function NewListingPage() {
  await requireRole("landlord", { redirectTo: "/dashboard/listings/new" });

  return (
    <AppShell width="md" className="pt-2 md:pt-20">
      <BackLink href="/dashboard">Dashboard</BackLink>
      <PageHeader
        eyebrow="Listing management"
        title="Create listing"
        description="Save a structured draft first, then add photos and publish when it is ready."
      />
      <ListingForm mode="create" googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} />
    </AppShell>
  );
}
