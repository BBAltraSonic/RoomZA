import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ArrowLeft, Building2, User } from "lucide-react";

import { PropertyCard } from "@/components/premium/property-card";
import { getListerProfile } from "@/features/profile/api";
import { ReportPanel } from "@/features/admin/components/report-panel";
import { getSessionProfile } from "@/lib/auth";
import { LandlordTrustSignals } from "@/features/trust/components/landlord-trust-signals";
import { PresenceBadge } from "@/features/presence/presence-badge";
type ListerPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ListerPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getListerProfile(id);

  if (!data) {
    return {
      title: "Lister Profile Not Found | Pinpoints",
      description: "This landlord profile is not available on Pinpoints.",
    };
  }

  const name = data.profile.full_name || "Landlord";
  const listingsCount = data.listings.length;

  return {
    title: `${name} - Lister Profile | Pinpoints`,
    description: `View rental listings by ${name} on Pinpoints. ${listingsCount} active listings. Trustworthy marketplace.`,
    robots: { index: true, follow: true },
  };
}

function formatMemberSince(dateStr?: string | null) {
  if (!dateStr) return "Member";
  const date = new Date(dateStr);
  return `Member since ${date.toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}`;
}

export default async function ListerProfilePage({ params }: ListerPageProps) {
  const { id } = await params;
  const data = await getListerProfile(id);
  const { user } = await getSessionProfile();

  if (!data) {
    notFound();
  }

  const { profile, listings, landlordTrust, landlordPresence } = data;
  const name = profile.full_name || "Landlord";
  const initials = name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "L";

  return (
    <main
      className="min-h-dvh bg-background px-4 pb-[calc(var(--mobile-bottom-nav-h)+var(--mobile-safe-bottom)+2rem)] text-foreground sm:px-6 sm:pb-32 sm:pt-20 lg:px-8"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)" }}
    >
      <div className="mx-auto max-w-6xl">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            id="lister-back-btn"
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-forest hover:text-forest/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest rounded-md px-2 py-1 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to map
          </Link>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Lister Summary Card (Sticky on Large Screens) */}
          <div className="lg:col-span-4 lg:h-fit lg:sticky lg:top-24">
            <div className="rounded-2xl border border-border/40 bg-panel p-6 shadow-[var(--elevation-1)]">
              {/* Profile Pic / Initials */}
              <div className="flex flex-col items-center text-center">
                <div className="relative flex size-24 items-center justify-center rounded-full bg-forest/10 border-2 border-forest/20 text-forest overflow-hidden mb-4">
                  {profile.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={name}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold tracking-wider">{initials}</span>
                  )}
                </div>

                <h1 className="text-xl font-bold tracking-tight text-ink">{name}</h1>
                <PresenceBadge
                  badge={landlordPresence}
                  responseSeconds={landlordTrust.predictedResponseSeconds}
                  predicted
                  className="mt-2"
                />
                
                <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1 justify-center">
                  <CalendarDays className="size-3.5 text-muted-foreground" />
                  {formatMemberSince(profile.created_at)}
                </p>
              </div>

              {/* Public trust evidence */}
              <div className="mt-6 border-t border-border/40 pt-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Trust signals
                </h2>
                <LandlordTrustSignals summary={landlordTrust} showEmpty />
              </div>

              {/* Lister activity */}
              <div className="mt-6 border-t border-border/40 pt-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Lister Stats
                </h2>
                <div className="grid gap-4">
                  <div className="rounded-lg bg-warm-surface p-3 border border-border/30">
                    <p className="text-xs text-muted-foreground mb-0.5">Listings</p>
                    <p className="text-lg font-bold text-ink flex items-center gap-1.5">
                      <Building2 className="size-4 text-forest" />
                      {listings.length}
                    </p>
                  </div>
                </div>
              </div>
              {user ? <div className="mt-5"><ReportPanel reportedUserId={id} label="Report this lister" /></div> : <p className="mt-5 text-xs leading-5 text-muted-foreground"><Link href={`/auth?redirect=/lister/${id}`} className="font-semibold text-forest hover:underline">Sign in to report this lister</Link>, or use the <Link href="/trust/safety" className="font-semibold text-forest hover:underline">published safety contact</Link>.</p>}
            </div>
          </div>

          {/* Right Column: About Section & Active Listings */}
          <div className="lg:col-span-8 space-y-8">
            {/* About Section */}
            <section className="rounded-2xl border border-border/40 bg-panel p-6 shadow-[var(--elevation-1)]">
              <h2 className="text-lg font-bold tracking-tight text-ink mb-3">About {name}</h2>
              {profile.about ? (
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {profile.about}
                </p>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-warm-surface px-4 py-3 text-sm text-muted-foreground">
                  <User className="size-4 shrink-0 text-muted-foreground" />
                  <p>No description provided by the landlord yet.</p>
                </div>
              )}
            </section>

            {/* Listings Section */}
            <section>
              <h2 className="text-lg font-bold tracking-tight text-ink mb-4">
                Active Listings ({listings.length})
              </h2>

              {listings.length === 0 ? (
                <div className="rounded-2xl border border-border/40 bg-panel p-8 text-center shadow-[var(--elevation-1)]">
                  <Building2 className="mx-auto size-10 text-muted-foreground mb-3" />
                  <h3 className="text-sm font-bold text-ink">No active listings</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    This landlord does not currently have any published listings available.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {listings.map((listing) => (
                    <PropertyCard
                      key={listing.id}
                      href={`/?listingId=${listing.id}`}
                      property={{
                        id: listing.id,
                        title: listing.title,
                        address: listing.address,
                        price: listing.price,
                        bedrooms: listing.bedrooms,
                        bathrooms: listing.bathrooms,
                        imageUrl: listing.listing_images?.[0]?.public_url || null,
                        imageUrls: listing.listing_images?.map((img) => img.public_url) || null,
                        availabilityDate: listing.availability_date,
                        createdAt: listing.created_at,
                        landlordTrust,
                        landlordPresence,
                        liveTourId: listing.liveTourId,
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
