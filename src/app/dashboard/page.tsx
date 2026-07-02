import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Bath, Bed, Building2, Plus, Users } from "lucide-react";
import { Suspense } from "react";

import { AppShell, EmptyState, MetricStrip, PageHeader, StatusBadge } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/route-state";
import { getDashboardListingSupport, getMyListings } from "@/features/listings/actions";
import { ListingControls } from "@/features/listings/components/listing-controls";
import { ListingFilters } from "@/features/listings/components/listing-filters";
import { ListingInsightsPanel } from "@/features/listings/components/listing-insights-panel";
import { PublishChecklist } from "@/features/listings/components/publish-checklist";
import { organizeListings, type ListingOrganizationParams } from "@/features/listings/listing-organization";
import { countDraftListings, countPublishedListings, getListingStatusTone, isDraftListing } from "@/features/listings/listing-status";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

import { formatPrice } from "@/lib/utils";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<ListingOrganizationParams> }) {
  const { profile } = await requireRole("landlord", { redirectTo: "/dashboard" });
  const params = await searchParams;
  const listingsResult = await getMyListings();

  if (!listingsResult.success) {
    return (
      <AppShell width="xl" className="pt-2 md:pt-20">
        <PageHeader eyebrow="Landlord workspace" title="Listings" description={profile.email} />
        <EmptyState
          icon={AlertCircle}
          title="Unable to load listings"
          description="The dashboard could not load your listings. Refresh the page or try again later."
        />
      </AppShell>
    );
  }

  const listings = organizeListings(listingsResult.data ?? [], params);
  const publishedCount = countPublishedListings(listings);
  const draftCount = countDraftListings(listings);
  const supportPromise = getDashboardListingSupport(listings.map((listing) => listing.id));

  return (
    <AppShell width="xl" className="pt-2 md:pt-20">
      <PageHeader
        eyebrow="Landlord workspace"
        title="Listings"
        description={profile.email}
        action={
          <Button render={<Link href="/dashboard/listings/new" />} className="h-10 bg-forest px-4 text-primary-foreground hover:bg-forest/90">
            <Plus className="size-4" />
            New listing
          </Button>
        }
        meta={
          <MetricStrip
            metrics={[
              { label: "Published", value: publishedCount, tone: "forest" },
              { label: "Drafts", value: draftCount, tone: "clay" },
              { label: "Total", value: listings.length },
            ]}
          />
        }
      />

      <ListingFilters />

      <Suspense fallback={null}>
        <DashboardSupportNotice supportPromise={supportPromise} />
      </Suspense>

      {listings.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No listings yet"
          description="Create your first rental draft, add photos, then publish when the application details are ready."
          action={
            <Button render={<Link href="/dashboard/listings/new" />} className="h-10 bg-forest text-primary-foreground hover:bg-forest/90">
              <Plus className="size-4" />
              Add first listing
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {listings.map((listing) => {
            const thumbnailUrl = [...(listing.listing_images ?? [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0]?.public_url ?? "";
            const applicationCount = Array.isArray(listing.applications) ? listing.applications.length : 0;
            return (
              <article key={listing.id} className="overflow-hidden rounded-2xl border border-border bg-panel shadow-[var(--elevation-1)]">
                <div className="grid sm:grid-cols-[220px_1fr]">
                  <div className="relative aspect-[16/10] bg-muted sm:aspect-auto sm:min-h-52">
                    {thumbnailUrl ? (
                      <Image src={thumbnailUrl} alt={listing.title} fill sizes="220px" className="object-cover" />
                    ) : (
                      <div className="flex h-full min-h-52 flex-col items-center justify-center text-muted-foreground">
                        <Building2 className="mb-2 size-8" />
                        <span className="text-xs font-medium uppercase">No photos</span>
                      </div>
                    )}
                    <div className="absolute left-3 top-3">
                      <StatusBadge tone={getListingStatusTone(listing.status)}>
                        {listing.status}
                      </StatusBadge>
                    </div>
                    {isDraftListing(listing.status) ? (
                      <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                        <AlertCircle className="size-3.5" />
                        Needs publishing
                      </div>
                    ) : null}
                  </div>

                  <div className="flex min-w-0 flex-col p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold uppercase text-clay">
                        {listing.address.split(",")[0] || "No location"}
                      </p>
                      <h2 className="mt-1 line-clamp-2 text-lg font-semibold text-ink">
                        {listing.title || "Untitled listing"}
                      </h2>
                      <p className="mt-3 text-xl font-semibold text-ink">
                        {formatPrice(listing.price)}
                        <span className="ml-1 text-sm font-medium text-muted-foreground">/mo</span>
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-sm font-bold text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Bed className="size-4 text-forest" />
                          {listing.bedrooms}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Bath className="size-4 text-forest" />
                          {listing.bathrooms}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="size-4 text-forest" />
                          {applicationCount}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      <Suspense fallback={<ListingSupportFallback />}>
                        <DashboardListingSupport
                          listingId={listing.id}
                          listingStatus={listing.status}
                          supportPromise={supportPromise}
                        />
                      </Suspense>
                      <ListingControls listingId={listing.id} status={listing.status} applicantCount={applicationCount} />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

type DashboardSupportPromise = ReturnType<typeof getDashboardListingSupport>;

async function DashboardSupportNotice({ supportPromise }: { supportPromise: DashboardSupportPromise }) {
  const supportResult = await supportPromise;

  if (supportResult.success) return null;

  return (
    <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{supportResult.error}</p>
    </div>
  );
}

async function DashboardListingSupport({
  listingId,
  listingStatus,
  supportPromise,
}: {
  listingId: string;
  listingStatus: string | null;
  supportPromise: DashboardSupportPromise;
}) {
  const supportResult = await supportPromise;

  if (!supportResult.success) return null;

  const support = supportResult.data[listingId];
  if (!support) return null;

  return (
    <>
      {isDraftListing(listingStatus ?? "") ? <PublishChecklist readiness={support.readiness} /> : null}
      <ListingInsightsPanel insights={support.insights} />
    </>
  );
}

function ListingSupportFallback() {
  return <LoadingSkeleton title="Loading listing analytics" rows={2} className="shadow-none" />;
}
