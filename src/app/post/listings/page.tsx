import type { Metadata } from "next";
import { BusinessAssistantButton } from "@/features/assistant/business/business-assistant-button";
import { getImportAccess } from "@/features/listing-imports/access";
import { PropertyListingCards } from "@/features/listings/components/property-listing-cards";
import type { ListingOrganizationParams } from "@/features/listings/listing-organization";
import { buildMyListings, listingCategoryMeta, parseListingCategory } from "@/features/marketplace/my-listings";
import { loadMyListings } from "@/features/marketplace/my-listings-data";
import { ManagedItemList, MyListingsView } from "@/features/marketplace/my-listings-view";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "My listings", robots: { index: false, follow: false } };

type SearchParams = ListingOrganizationParams & { category?: string | string[] };

/** Every listing a person manages, in every category, on one page. */
export default async function MyListingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser({ redirectTo: "/post/listings" });
  const [params, loads, importAccess] = await Promise.all([searchParams, loadMyListings(), getImportAccess()]);
  const view = buildMyListings(loads, parseListingCategory(params.category));
  const list = (category: "services" | "offers" | "places" | "events") =>
    <ManagedItemList items={loads[category].items} hasMore={loads[category].hasMore}
      moreHref={listingCategoryMeta[category].workspaceHref}
      emptyText={`No ${listingCategoryMeta[category].label.toLowerCase()} yet.`} />;

  return <MyListingsView
    view={view}
    importAllowed={importAccess.allowed}
    assistant={<BusinessAssistantButton />}
    sections={{
      property: <PropertyListingCards rows={loads.property.rows} params={params}
        upcomingTours={loads.property.upcomingTours} scheduledToursEnabled={loads.property.scheduledToursEnabled} />,
      services: list("services"),
      offers: list("offers"),
      places: list("places"),
      events: list("events"),
    }}
  />;
}
