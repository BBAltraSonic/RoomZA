import type { Metadata } from "next";

import { AppShell, BackLink, PageHeader } from "@/components/premium/primitives";
import { ListingDraftForm } from "@/features/listings/listing-draft-form";
import { requireAnyPersona } from "@/lib/auth";

export const metadata: Metadata = {
  title: "New Listing | Pinpoints",
  description: "Create a new rental listing on Pinpoints.",
};

export default async function NewListingPage() {
  await requireAnyPersona(["landlord", "seller"], { redirectTo: "/dashboard/listings/new" });

  return (
    <AppShell width="md" className="pt-2 md:pt-20">
      <BackLink href="/dashboard">Dashboard</BackLink>
      <PageHeader
        eyebrow="Listing management"
        title="Create a quick draft"
        description="Start with the property essentials. Complete the operational details before publishing."
      />
      <ListingDraftForm
        mapApiKey={process.env.NEXT_PUBLIC_MAPTILER_API_KEY}
      />
    </AppShell>
  );
}
