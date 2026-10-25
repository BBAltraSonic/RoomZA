import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  Home,
  Languages,
  Mail,
  Phone,
  Star,
} from "lucide-react";

import { ReportPanel } from "@/features/admin/components/report-panel";
import { PublicProfileActions } from "@/features/profile/components/public-profile-actions";
import { getPublicProfileByUsername } from "@/features/profile/data";
import { getSessionProfile } from "@/lib/auth";
import { marketplacePersonaLabels } from "@/lib/personas";
import { StatusBadge } from "@/components/premium/primitives";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfileByUsername(username);
  if (!profile)
    return {
      title: "Profile not found",
      robots: { index: false, follow: false },
    };
  return {
    title: `${profile.displayName} (@${profile.username})`,
    description:
      profile.bio ??
      `View ${profile.displayName}'s public-safe profile on Pinpoint.`,
    robots: { index: profile.searchIndexed, follow: profile.searchIndexed },
  };
}

function memberSince(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const [profile, session] = await Promise.all([
    getPublicProfileByUsername(username),
    getSessionProfile(),
  ]);
  if (!profile) notFound();
  const initials = profile.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <main className="min-h-dvh bg-background px-4 pb-28 pt-6 text-foreground sm:px-6 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-forest"
        >
          ← Back to map
        </Link>
        <div className="mt-5 grid grid-cols-1 gap-10 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="min-w-0 lg:sticky lg:top-20 lg:h-fit">
            <div className="flex items-center gap-4 lg:flex-col lg:items-start">
              <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-accent text-2xl font-semibold text-forest">
                {profile.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">
                  {profile.displayName}
                </h1>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  @{profile.username}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.personas.map((persona) => (
                    <StatusBadge key={persona} tone="forest">
                      {marketplacePersonaLabels[persona]}
                    </StatusBadge>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6">
              <PublicProfileActions
                profileId={profile.id}
                username={profile.username}
                signedIn={Boolean(session.user)}
                canMessage={profile.contact.canMessage}
                isMuted={profile.viewerState.isMuted}
                listings={profile.activeListings.map(({ id, title }) => ({
                  id,
                  title,
                }))}
              />
            </div>
            <dl className="mt-6 divide-y divide-border border-y border-border text-sm">
              <div className="flex items-center gap-3 py-3">
                <CalendarDays className="size-4 text-forest" />
                <div>
                  <dt className="sr-only">Member since</dt>
                  <dd className="text-muted-foreground">
                    Member since {memberSince(profile.joinedAt)}
                  </dd>
                </div>
              </div>
              {profile.languages.length ? (
                <div className="flex items-center gap-3 py-3">
                  <Languages className="size-4 text-forest" />
                  <div>
                    <dt className="sr-only">Languages</dt>
                    <dd className="text-muted-foreground">
                      {profile.languages.join(", ")}
                    </dd>
                  </div>
                </div>
              ) : null}
              {profile.contact.email ? (
                <div className="flex items-center gap-3 py-3">
                  <Mail className="size-4 shrink-0 text-forest" />
                  <div className="min-w-0">
                    <dt className="sr-only">Email</dt>
                    <dd className="text-muted-foreground [overflow-wrap:anywhere]">
                      {profile.contact.email}
                    </dd>
                  </div>
                </div>
              ) : null}
              {profile.contact.phone ? (
                <div className="flex items-center gap-3 py-3">
                  <Phone className="size-4 shrink-0 text-forest" />
                  <div className="min-w-0">
                    <dt className="sr-only">Phone</dt>
                    <dd className="text-muted-foreground [overflow-wrap:anywhere]">
                      {profile.contact.phone}
                    </dd>
                  </div>
                </div>
              ) : null}
            </dl>
            {session.user && !profile.viewerState.isOwner ? (
              <div className="mt-6">
                <ReportPanel
                  reportedUserId={profile.id}
                  label="Report this profile"
                />
              </div>
            ) : null}
          </aside>

          <div className="min-w-0 space-y-10 [overflow-wrap:anywhere]">
            <section aria-labelledby="about-heading">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
                Public-safe profile
              </p>
              <h2
                id="about-heading"
                className="mt-2 text-xl font-semibold text-ink"
              >
                About
              </h2>
              <p className="mt-4 max-w-[68ch] whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {profile.bio || "This member has not added a public bio yet."}
              </p>
            </section>

            <section aria-labelledby="trust-heading">
              <h2 id="trust-heading" className="text-xl font-semibold text-ink">
                Trust evidence
              </h2>
              <div className="mt-4 grid border-l border-t border-border sm:grid-cols-3">
                <div className="border-b border-r border-border p-4">
                  <BadgeCheck className="size-5 text-forest" />
                  <p className="mt-3 text-2xl font-semibold text-ink">
                    {profile.verificationBadges.length}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Verified checks
                  </p>
                </div>
                <div className="border-b border-r border-border p-4">
                  <Star className="size-5 text-forest" />
                  <p className="mt-3 text-2xl font-semibold text-ink">
                    {profile.reviewSummary.average ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {profile.reviewSummary.publishedCount} verified reviews
                  </p>
                </div>
                <div className="border-b border-r border-border p-4">
                  <Clock3 className="size-5 text-forest" />
                  <p className="mt-3 text-lg font-semibold text-ink">
                    {profile.responseStatistics.medianFirstResponseSeconds
                      ? `~${Math.max(1, Math.round(profile.responseStatistics.medianFirstResponseSeconds / 60))} min`
                      : "No data"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Median first response
                  </p>
                </div>
              </div>
              {profile.verificationBadges.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.verificationBadges.map((badge) => (
                    <StatusBadge key={badge} tone="success">
                      {badge.replaceAll("_", " ")} verified
                    </StatusBadge>
                  ))}
                </div>
              ) : null}
            </section>

            <section aria-labelledby="listings-heading">
              <h2
                id="listings-heading"
                className="text-xl font-semibold text-ink"
              >
                Active listings
              </h2>
              {profile.activeListings.length ? (
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  {profile.activeListings.map((listing) => (
                    <Link
                      key={listing.id}
                      href={`/?listingId=${listing.id}`}
                      className="group overflow-hidden rounded-xl border border-border bg-panel outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="relative aspect-[16/10] bg-muted">
                        {listing.imageUrl ? (
                          <Image
                            src={listing.imageUrl}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 100vw, 320px"
                            className="object-cover transition-transform group-hover:scale-[1.02]"
                          />
                        ) : (
                          <Home className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
                        )}
                      </div>
                      <div className="p-4">
                        <p className="truncate text-sm font-semibold text-ink">
                          {listing.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {listing.address}
                        </p>
                        <p className="mt-3 text-sm font-semibold text-forest">
                          R {listing.price.toLocaleString("en-ZA")}
                          {listing.listingType === "rent" ? " / month" : ""}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No active listings right now.
                </p>
              )}
            </section>

            <section aria-labelledby="reviews-heading">
              <h2
                id="reviews-heading"
                className="text-xl font-semibold text-ink"
              >
                Verified reviews
              </h2>
              {profile.reviews.length ? (
                <ul className="mt-4 divide-y divide-border border-y border-border">
                  {profile.reviews.map((review) => (
                    <li key={review.id} className="py-5">
                      <div className="flex items-center gap-2">
                        <Star className="size-4 fill-current text-forest" />
                        <span className="text-sm font-semibold text-ink">
                          {review.overall}/5
                        </span>
                        <StatusBadge tone="success">
                          Verified interaction
                        </StatusBadge>
                      </div>
                      {review.body ? (
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {review.body}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No published reviews yet. Averages appear after three reviews.
                </p>
              )}
            </section>

            {profile.publicActivity.length ? (
              <section aria-labelledby="activity-heading">
                <h2
                  id="activity-heading"
                  className="text-xl font-semibold text-ink"
                >
                  Public activity
                </h2>
                <ul className="mt-4 divide-y divide-border border-y border-border">
                  {profile.publicActivity.map((event) => (
                    <li key={event.id} className="py-4">
                      <p className="text-sm font-semibold text-ink">
                        {event.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("en-ZA", {
                          dateStyle: "medium",
                        }).format(new Date(event.occurredAt))}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
