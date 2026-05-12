import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Users, Building2, Pencil, Plus, MapPin, Bed, Bath, AlertCircle } from "lucide-react";

import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getMyListings } from "@/features/listings/actions";
import { UnpublishButton } from "@/features/listings/unpublish-button";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: "bg-amber-100/50 text-amber-700 border-amber-200/50",
    published: "bg-[#e7f2ee] text-[#173b33] border-[#2b6357]/20",
    archived: "bg-zinc-100 text-zinc-600 border-zinc-200",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  );
}

function formatPrice(price: number) {
  return `R ${new Intl.NumberFormat("en-ZA").format(price)}`;
}

export default async function DashboardPage() {
  const { profile } = await requireRole("landlord");
  const listings = await getMyListings();

  const publishedCount = listings.filter((l) => l.status === "published").length;
  const draftCount = listings.filter((l) => l.status === "draft").length;

  return (
    <main className="min-h-screen bg-background pb-12 pt-8 text-foreground">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">

        {/* Header Section */}
        <div className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-widest text-[#b86f42]">Landlord Workspace</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">Properties</h1>
            <p className="mt-2 text-sm text-muted-foreground">{profile.email}</p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="flex gap-4 pr-6 text-sm">
              <div className="flex flex-col">
                <span className="text-2xl font-medium tracking-tight">{publishedCount}</span>
                <span className="text-muted-foreground">Published</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-medium tracking-tight text-amber-700">{draftCount}</span>
                <span className="text-muted-foreground">Drafts</span>
              </div>
            </div>
            <Button render={<Link href="/dashboard/listings/new" />} className="rounded-full bg-[#173b33] px-6 text-white shadow-md hover:bg-[#102a24] hover:shadow-lg">
              <Plus className="mr-2 size-4" />
              New Listing
            </Button>
          </div>
        </div>

        {/* Listings Grid */}
        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-muted/10 py-24 text-center">
            <div className="rounded-full bg-white p-5 shadow-sm">
              <Building2 className="size-10 text-muted-foreground/40" />
            </div>
            <h3 className="mt-6 text-xl font-medium tracking-tight">No properties yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Add your first rental property to start receiving verified applications from high-quality renters.
            </p>
            <Button
              render={<Link href="/dashboard/listings/new" />}
              className="mt-8 rounded-full bg-[#173b33] px-6 text-white hover:bg-[#102a24]"
            >
              <Plus className="mr-2 size-4" />
              Add your first property
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => {
              // Extract first image safely
              let thumbnailUrl = "";
              if (Array.isArray(listing.listing_images) && listing.listing_images.length > 0) {
                // Sort by sort_order
                const sortedImages = [...listing.listing_images].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
                thumbnailUrl = sortedImages[0]?.public_url || "";
              }

              // Extract application count safely (we fetch id now)
              const applicationCount = Array.isArray(listing.applications) ? listing.applications.length : 0;

              return (
                <div key={listing.id} className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/40 bg-white transition-all duration-300 hover:border-[#2b6357]/30 hover:shadow-xl hover:shadow-[#e7f2ee]">

                  {/* Thumbnail Area */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/20">
                    {thumbnailUrl ? (
                      <Image
                        src={thumbnailUrl}
                        alt={listing.title}
                        fill
                        unoptimized
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition duration-700 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground/40">
                        <Building2 className="mb-2 size-8" />
                        <span className="text-xs font-medium uppercase tracking-wider">No photos</span>
                      </div>
                    )}
                    <div className="absolute left-3 top-3">
                      {statusBadge(listing.status)}
                    </div>
                    {listing.status === "draft" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/5 pb-8 backdrop-blur-[1px] transition group-hover:bg-black/0">
                        <div className="flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm">
                          <AlertCircle className="size-3.5" />
                          Needs attention
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content Area */}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <MapPin className="size-3 text-[#b86f42]" />
                      <span className="truncate">{listing.address.split(",")[0] || "No location"}</span>
                    </div>
                    <h3 className="line-clamp-1 text-lg font-medium tracking-tight text-foreground">{listing.title || "Untitled Property"}</h3>

                    <div className="mt-4 flex flex-1 items-end justify-between">
                      <div>
                        <p className="text-xl font-semibold tracking-tight">{formatPrice(listing.price)}<span className="text-sm font-normal text-muted-foreground"> /mo</span></p>
                        <div className="mt-1 flex items-center gap-3 text-[13px] font-medium text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Bed className="size-3.5" /> {listing.bedrooms}</span>
                          <span className="flex items-center gap-1.5"><Bath className="size-3.5" /> {listing.bathrooms}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {applicationCount > 0 ? (
                          <Button
                            render={<Link href={`/dashboard/listings/${listing.id}/applicants`} />}
                            className="rounded-full bg-[#173b33] px-4 text-white shadow-sm transition-colors hover:bg-[#102a24]"
                          >
                            <Users className="mr-1.5 size-3.5" />
                            {applicationCount} {applicationCount === 1 ? "Applicant" : "Applicants"}
                          </Button>
                        ) : (
                          <Button
                            render={<Link href={`/dashboard/listings/${listing.id}/applicants`} />}
                            variant="secondary"
                            className="rounded-full bg-muted/60 px-4 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Users className="mr-1.5 size-3.5" />
                            Waitlist
                          </Button>
                        )}
                        {listing.status === "published" && (
                          <UnpublishButton listingId={listing.id} />
                        )}
                        <Button
                          render={<Link href={`/dashboard/listings/${listing.id}/edit`} />}
                          variant="secondary"
                          className="rounded-full bg-[#e7f2ee] px-3 text-[#173b33] transition-colors hover:bg-[#2b6357] hover:text-white"
                          title="Edit Listing"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
