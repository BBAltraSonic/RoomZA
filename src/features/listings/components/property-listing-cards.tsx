import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Bath, Bed, Building2 } from "lucide-react";
import { Suspense } from "react";

import { StatusBadge } from "@/components/premium/primitives";
import { LoadingSkeleton } from "@/components/ui/route-state";
import type { getHostUpcomingLiveTours } from "@/features/live-tours/actions";
import { getDashboardListingSupport, type getMyListings } from "@/features/listings/actions";
import { ListingControls } from "@/features/listings/components/listing-controls";
import { ListingFilters } from "@/features/listings/components/listing-filters";
import { ListingInsightsPanel } from "@/features/listings/components/listing-insights-panel";
import { PublishChecklist } from "@/features/listings/components/publish-checklist";
import { organizeListings, type ListingOrganizationParams } from "@/features/listings/listing-organization";
import { countDraftListings, countPublishedListings, getListingStatusTone, isDraftListing } from "@/features/listings/listing-status";
import { formatPrice } from "@/lib/utils";

type PropertyRows = Extract<Awaited<ReturnType<typeof getMyListings>>, { success: true }>["data"];
type UpcomingTours = Awaited<ReturnType<typeof getHostUpcomingLiveTours>>;

/**
 * The property owner's cards: photo, status, price and the per-listing tools
 * (applicants, edit, publish, live tours, insights). Shown on My listings.
 */
export function PropertyListingCards({ rows, params, upcomingTours, scheduledToursEnabled }: {
  rows: PropertyRows;
  params: ListingOrganizationParams;
  upcomingTours: UpcomingTours;
  scheduledToursEnabled: boolean;
}) {
  const listings = organizeListings(rows, params);
  const supportPromise = getDashboardListingSupport(listings.map((listing) => listing.id));
  const upcomingTourByListing = new Map(upcomingTours.map((tour) => [tour.listing_id, tour]));
  const published = countPublishedListings(rows);
  const drafts = countDraftListings(rows);

  return <>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
      <p className="text-muted-foreground">{published} published · {drafts} {drafts === 1 ? "draft" : "drafts"}</p>
      {/* Each card links to its own applicants; these two cover every home at once. */}
      {rows.length ? <nav aria-label="Across all homes" className="flex gap-4 font-semibold text-brand-ink">
        <Link href="/dashboard/applicants" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">All applicants</Link>
        <Link href="/dashboard/viewings" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">Viewings</Link>
      </nav> : null}
    </div>
    {/* Search and sort only earn their place once there is more than one home to sort. */}
    {rows.length > 1 ? <ListingFilters /> : null}

    <Suspense fallback={null}>
      <SupportNotice supportPromise={supportPromise} />
    </Suspense>

    {listings.length === 0 ? (
      <p className="rounded-xl border border-border bg-panel p-4 text-sm text-muted-foreground">
        {rows.length ? "No homes match these filters." : "No homes listed yet."}
      </p>
    ) : (
      <div className="grid gap-4 lg:grid-cols-2">
        {listings.map((listing) => {
          const thumbnailUrl = [...(listing.listing_images ?? [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0]?.public_url ?? "";
          const applicationCount = Array.isArray(listing.applications) ? listing.applications.length : 0;
          return (
            <article id={`listing-${listing.id}`} key={listing.id} className="@container scroll-mt-24 overflow-hidden rounded-[var(--radius-card)_var(--radius-cut)_var(--radius-card)_var(--radius-card)] border border-border bg-panel shadow-[var(--shadow-card)]">
              <div className="grid @min-[42rem]:grid-cols-[220px_1fr]">
                <div className="relative aspect-[16/10] bg-muted @min-[42rem]:aspect-auto @min-[42rem]:min-h-52">
                  {thumbnailUrl ? (
                    <Image src={thumbnailUrl} alt={listing.title} fill sizes="(min-width: 672px) 220px, 100vw" className="object-cover" />
                  ) : (
                    <div className="flex h-full min-h-52 flex-col items-center justify-center text-muted-foreground">
                      <Building2 className="mb-2 size-8" />
                      <span className="text-xs font-medium uppercase">No photos</span>
                    </div>
                  )}
                  <div className="absolute left-3 top-3">
                    <StatusBadge tone={getListingStatusTone(listing.status)}>{listing.status}</StatusBadge>
                  </div>
                  {isDraftListing(listing.status) ? (
                    <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-md border border-status-warning-border bg-status-warning-surface px-2 py-1 text-xs font-semibold text-status-warning-text">
                      <AlertCircle className="size-3.5" />
                      Needs publishing
                    </div>
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-col p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold uppercase text-clay">{listing.address.split(",")[0] || "No location"}</p>
                    <h3 className="mt-1 line-clamp-2 text-lg font-semibold text-ink">{listing.title || "Untitled listing"}</h3>
                    <p className="mt-3 text-xl font-semibold text-ink">
                      {formatPrice(listing.listing_type === "sale" ? listing.sale_price ?? listing.price : listing.price)}
                      {listing.listing_type !== "sale" ? <span className="ml-1 text-sm font-medium text-muted-foreground">/mo</span> : null}
                    </p>
                    {/* The applicant count lives on the Applicants button below, so it is not repeated here. */}
                    <div className="mt-3 flex items-center gap-4 text-sm font-bold text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Bed className="size-4 text-forest" />{listing.bedrooms}</span>
                      <span className="flex items-center gap-1.5"><Bath className="size-4 text-forest" />{listing.bathrooms}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <Suspense fallback={<LoadingSkeleton title="Loading listing analytics" rows={2} className="shadow-none" />}>
                      <ListingSupport listingId={listing.id} listingStatus={listing.status} supportPromise={supportPromise} />
                    </Suspense>
                    <ListingControls
                      expectedUpdatedAt={listing.updated_at}
                      listingId={listing.id}
                      status={listing.status}
                      applicantCount={applicationCount}
                      upcomingTour={upcomingTourByListing.get(listing.id)}
                      scheduledToursEnabled={scheduledToursEnabled}
                    />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    )}
  </>;
}

type SupportPromise = ReturnType<typeof getDashboardListingSupport>;

async function SupportNotice({ supportPromise }: { supportPromise: SupportPromise }) {
  const supportResult = await supportPromise;
  if (supportResult.success) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{supportResult.error}</p>
    </div>
  );
}

async function ListingSupport({ listingId, listingStatus, supportPromise }: {
  listingId: string; listingStatus: string | null; supportPromise: SupportPromise;
}) {
  const supportResult = await supportPromise;
  if (!supportResult.success) return null;
  const support = supportResult.data[listingId];
  if (!support) return null;
  return (
    <>
      {support.restriction ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-semibold">Hidden from public discovery</p>
          <p className="mt-1 leading-5">{support.restriction.reason}</p>
        </div>
      ) : null}
      {isDraftListing(listingStatus ?? "") ? <PublishChecklist readiness={support.readiness} /> : null}
      <ListingInsightsPanel insights={support.insights} />
    </>
  );
}
