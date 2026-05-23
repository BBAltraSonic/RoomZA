import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Bath, Bed, Building2, Pencil, Plus, Users } from "lucide-react";

import { AppShell, EmptyState, MetricStrip, PageHeader, StatusBadge } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";
import { getMyListings } from "@/features/listings/actions";
import { UnpublishButton } from "@/features/listings/unpublish-button";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

function formatPrice(price: number) {
  return `R ${new Intl.NumberFormat("en-ZA").format(price)}`;
}

export default async function DashboardPage() {
  const { profile } = await requireRole("landlord");
  const listings = await getMyListings();
  const publishedCount = listings.filter((listing) => listing.status === "published").length;
  const draftCount = listings.filter((listing) => listing.status === "draft").length;

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
                      <Image src={thumbnailUrl} alt={listing.title} fill unoptimized sizes="220px" className="object-cover" />
                    ) : (
                      <div className="flex h-full min-h-52 flex-col items-center justify-center text-muted-foreground">
                        <Building2 className="mb-2 size-8" />
                        <span className="text-xs font-medium uppercase">No photos</span>
                      </div>
                    )}
                    <div className="absolute left-3 top-3">
                      <StatusBadge tone={listing.status === "published" ? "forest" : "warning"}>
                        {listing.status}
                      </StatusBadge>
                    </div>
                    {listing.status === "draft" ? (
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

                    <div className="mt-6 grid gap-2.5 border-t border-border pt-4 sm:flex sm:flex-wrap">
                      <Button
                        render={<Link href={`/dashboard/listings/${listing.id}/applicants`} />}
                        className="h-11 bg-forest text-primary-foreground hover:bg-forest/90 active:scale-95 sm:h-9 sm:active:scale-100"
                      >
                        <Users className="size-4" />
                        {applicationCount === 1 ? "1 applicant" : `${applicationCount} applicants`}
                      </Button>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
                        <Button
                          render={<Link href={`/dashboard/listings/${listing.id}/edit`} />}
                          variant="outline"
                          className="h-11 active:scale-95 sm:h-9 sm:w-auto sm:active:scale-100"
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                        {listing.status === "published" ? (
                          <div className="h-11 sm:h-9">
                            <UnpublishButton listingId={listing.id} />
                          </div>
                        ) : null}
                      </div>
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
