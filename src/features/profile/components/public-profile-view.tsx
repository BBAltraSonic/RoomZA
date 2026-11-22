import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  Clock3,
  Eye,
  Languages,
  Mail,
  MessageSquareQuote,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Star,
} from "lucide-react";

import { ProfileListings } from "@/features/profile/components/profile-listings";
import {
  ProfileSafetyControls,
  PublicProfileActions,
} from "@/features/profile/components/public-profile-actions";
import {
  audienceLabels,
  coverImageFor,
  firstNameOf,
  formatMonthYear,
  initialsFor,
  listingCount,
  orderedVerifications,
  ownerChecklist,
  responseTimeLabel,
  tenure,
  verificationLabels,
} from "@/features/profile/public-profile-format";
import type { PublicProfile } from "@/features/profile/types";
import { marketplacePersonaLabels } from "@/lib/personas";
import { cn } from "@/lib/utils";

type Props = {
  profile: PublicProfile;
  signedIn: boolean;
  /** Injected for deterministic tests and previews. */
  now?: number;
};

export function PublicProfileView({ profile, signedIn, now }: Props) {
  const first = firstNameOf(profile.displayName);
  const isOwner = profile.viewerState.isOwner;
  const total = listingCount(profile);
  const showOwnerPreview = isOwner && Boolean(profile.ownerView);

  return (
    <main className="min-h-dvh bg-background pb-28 text-foreground sm:pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 sm:pt-8 lg:pt-10">
        <Link
          href="/"
          className="-ml-2 hidden min-h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold text-muted-foreground outline-none sm:inline-flex transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to map
        </Link>

        <div className="grid grid-cols-1 gap-8 sm:mt-3 lg:mt-5 lg:grid-cols-[22.5rem_minmax(0,1fr)] lg:gap-x-12 lg:gap-y-12">
          {/* The owner's banner frames the page, so it leads on phones and sits atop the content column on desktop. */}
          {showOwnerPreview ? (
            <div className="min-w-0 lg:col-start-2 lg:row-start-1">
              <OwnerPreview profile={profile} />
            </div>
          ) : null}

          <aside
            className={cn(
              "min-w-0 lg:sticky lg:top-6 lg:col-start-1 lg:self-start",
              showOwnerPreview ? "lg:row-span-2 lg:row-start-1" : "lg:row-start-1",
            )}
          >
            <IdentityCard profile={profile} signedIn={signedIn} now={now} />
          </aside>

          <div
            className={cn(
              "min-w-0 space-y-12 [overflow-wrap:anywhere] lg:col-start-2",
              showOwnerPreview ? "lg:row-start-2" : "lg:row-start-1",
            )}
          >
            <AboutSection profile={profile} first={first} />

            {total > 0 || profile.catalogue.status === "unavailable" || isOwner ? (
              <Section
                id="listings"
                title={isOwner ? "Your listings" : `${first}'s listings`}
                meta={total > 0 ? `${total} live` : null}
              >
                {profile.catalogue.status === "unavailable" ? (
                  <Notice
                    icon={<AlertCircle className="size-4" aria-hidden="true" />}
                    className="mb-5"
                  >
                    Some listings couldn&apos;t load just now, so this list may be incomplete.{" "}
                    <Link href={`/u/${profile.username}`} className="inline-flex items-center gap-1 font-semibold underline underline-offset-4">
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                      Try again
                    </Link>
                  </Notice>
                ) : null}
                {total > 0 ? (
                  <ProfileListings
                    properties={profile.activeListings}
                    services={profile.catalogue.services}
                    specials={profile.catalogue.specials}
                  />
                ) : isOwner ? (
                  <EmptyPanel
                    icon={<Plus className="size-5" aria-hidden="true" />}
                    title="Nothing listed yet"
                    body="Homes, services and specials you publish appear here, so people can see your work in one place."
                    action={
                      <Link
                        href="/post"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-control)] transition-colors hover:bg-[var(--forest-hover)]"
                      >
                        Create a listing <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    }
                  />
                ) : null}
              </Section>
            ) : null}

            <ReviewsSection profile={profile} first={first} />

            {profile.publicActivity.length ? (
              <Section id="activity" title="Recent activity">
                <ol className="relative space-y-5 border-l border-border pl-6">
                  {profile.publicActivity.map((event) => (
                    <li key={event.id} className="relative">
                      <span className="absolute -left-[1.84rem] top-1.5 size-2.5 rounded-full border-2 border-background bg-selection" aria-hidden="true" />
                      <p className="text-sm font-semibold text-ink">{event.title}</p>
                      {event.summary ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">{event.summary}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(new Date(event.occurredAt))}
                      </p>
                    </li>
                  ))}
                </ol>
              </Section>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function IdentityCard({ profile, signedIn, now }: { profile: PublicProfile; signedIn: boolean; now?: number }) {
  const cover = coverImageFor(profile);
  const verifications = orderedVerifications(profile.verificationBadges);
  const identityVerified = verifications.includes("identity");
  const time = tenure(profile.joinedAt, now);
  const response = responseTimeLabel(profile.responseStatistics.medianFirstResponseSeconds);
  const isOwner = profile.viewerState.isOwner;

  return (
    <section
      aria-labelledby="profile-name"
      className="overflow-hidden rounded-[24px] border border-border bg-panel shadow-[var(--elevation-2)]"
    >
      <div className="relative h-24 overflow-hidden bg-surface-chrome sm:h-32">
        {cover ? (
          <>
            <Image src={cover} alt="" fill priority sizes="(max-width: 1024px) 100vw, 360px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/55" />
          </>
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(80%_120%_at_85%_0%,color-mix(in_oklch,var(--brand-amber)_45%,transparent),transparent_65%),radial-gradient(60%_90%_at_0%_100%,color-mix(in_oklch,var(--brand-amber)_18%,transparent),transparent_70%)]"
          />
        )}
      </div>

      <div className="px-5 pb-5 sm:px-6">
        <div className="-mt-10 flex items-end justify-between gap-3 sm:-mt-12">
          <div className="relative">
            <div className="relative flex size-20 items-center justify-center overflow-hidden rounded-full border-4 border-panel bg-accent text-xl sm:size-24 sm:text-2xl font-semibold text-brand-ink shadow-[var(--elevation-1)]">
              {profile.avatarUrl ? (
                <Image src={profile.avatarUrl} alt="" fill sizes="(max-width: 640px) 80px, 96px" className="object-cover" />
              ) : (
                <span aria-hidden="true">{initialsFor(profile.displayName)}</span>
              )}
            </div>
            {identityVerified ? (
              <span
                className="absolute bottom-1 right-0 grid size-7 place-items-center rounded-full border-[3px] border-panel bg-selection text-selection-foreground"
                title="Identity verified"
              >
                <Check className="size-3.5 stroke-[3]" aria-hidden="true" />
                <span className="sr-only">Identity verified</span>
              </span>
            ) : null}
          </div>
          {profile.personas.length ? (
            <ul className="mb-1 flex flex-wrap justify-end gap-1.5" aria-label="Uses Pinpoint as">
              {profile.personas.map((persona) => (
                <li
                  key={persona}
                  className="rounded-full border border-border bg-warm-surface px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                >
                  {marketplacePersonaLabels[persona]}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <h1 id="profile-name" className="mt-2.5 text-2xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">
          {profile.displayName}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">@{profile.username}</p>

        <dl className="mt-4 grid grid-cols-3 divide-x divide-border rounded-[16px] border border-border bg-warm-surface/60">
          <Stat label={profile.reviewSummary.publishedCount === 1 ? "Review" : "Reviews"} value={String(profile.reviewSummary.publishedCount)} />
          <Stat
            label="Rating"
            value={
              profile.reviewSummary.average !== null ? (
                <span className="inline-flex items-center gap-1">
                  {profile.reviewSummary.average.toFixed(1)}
                  <Star className="size-3.5 fill-current text-selection" aria-hidden="true" />
                </span>
              ) : (
                <span className="text-muted-foreground">–</span>
              )
            }
            hint={profile.reviewSummary.average === null ? "After 3 reviews" : undefined}
          />
          <Stat label={time.label} value={time.value} />
        </dl>

        {response ? (
          <p className="mt-3.5 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="size-4 shrink-0 text-brand-ink" aria-hidden="true" />
            <span>
              Usually replies <span className="font-semibold text-ink">{response}</span>
            </span>
          </p>
        ) : null}

        <div className="mt-4 sm:mt-5">
          <PublicProfileActions
            profileId={profile.id}
            username={profile.username}
            displayName={profile.displayName}
            signedIn={signedIn}
            canMessage={profile.contact.canMessage}
            isOwner={isOwner}
            listings={profile.activeListings.map(({ id, title }) => ({ id, title }))}
          />
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ShieldCheck className="size-4 text-brand-ink" aria-hidden="true" />
            Verified by Pinpoint
          </h2>
          {verifications.length ? (
            <ul className="mt-3 grid gap-2.5">
              {verifications.map((kind) => (
                <li key={kind} className="flex items-center gap-2.5 text-sm text-ink">
                  <span className="grid size-5 place-items-center rounded-full bg-status-success-surface text-status-success-text">
                    <Check className="size-3 stroke-[3]" aria-hidden="true" />
                  </span>
                  {verificationLabels[kind]}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {isOwner ? "You haven't completed any checks yet." : "No checks completed yet."}
            </p>
          )}
          <Link
            href={isOwner ? "/profile/verification" : "/trust"}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-brand-ink underline-offset-4 hover:underline lg:min-h-8"
          >
            {isOwner ? "Add verification" : "How verification works"}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {!isOwner && signedIn ? (
          <div className="mt-2 border-t border-border pt-3">
            <ProfileSafetyControls
              profileId={profile.id}
              displayName={profile.displayName}
              signedIn={signedIn}
              isMuted={profile.viewerState.isMuted}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-2 py-3 text-center sm:py-3.5">
      <dt className="order-2 mt-1 text-[11px] font-medium leading-4 text-muted-foreground">{label}</dt>
      <dd className="order-1 text-xl font-semibold tabular-nums tracking-tight text-ink">{value}</dd>
      {hint ? <dd className="order-3 text-[10px] leading-4 text-muted-foreground/80">{hint}</dd> : null}
    </div>
  );
}

function OwnerPreview({ profile }: { profile: PublicProfile }) {
  const owner = profile.ownerView!;
  const checklist = ownerChecklist(profile);
  const done = checklist.filter((item) => item.done).length;
  const remaining = checklist.filter((item) => !item.done);

  return (
    <section
      aria-labelledby="owner-preview-heading"
      className="rounded-[24px] border border-[color-mix(in_oklch,var(--selection)_35%,var(--border))] bg-[color-mix(in_oklch,var(--selection)_9%,var(--panel))] p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-selection text-selection-foreground">
            <Eye className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="owner-preview-heading" className="text-base font-semibold text-ink">
              This is your public profile
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Who can see it: <span className="font-semibold text-ink">{audienceLabels[owner.profileAudience]}</span>
            </p>
            {!owner.reviewsVisible ? (
              <p className="mt-0.5 text-xs text-muted-foreground">Your reviews are hidden from visitors.</p>
            ) : null}
          </div>
        </div>
        <Link
          href="/settings/privacy"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-border bg-panel px-4 text-sm font-semibold text-ink shadow-[var(--shadow-control)] transition-colors hover:bg-accent lg:min-h-9"
        >
          Privacy settings
        </Link>
      </div>

      {remaining.length ? (
        <div className="mt-5 border-t border-[color-mix(in_oklch,var(--selection)_25%,var(--border))] pt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">Make a stronger first impression</p>
            <p className="text-xs font-semibold tabular-nums text-brand-ink">
              {done} of {checklist.length} done
            </p>
          </div>
          <div
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-panel ring-1 ring-inset ring-border"
            role="progressbar"
            aria-label="Profile checklist"
            aria-valuemin={0}
            aria-valuemax={checklist.length}
            aria-valuenow={done}
          >
            <div
              className="h-full rounded-full bg-selection transition-[width] duration-[var(--motion-slow)] ease-[var(--ease-out-expo)]"
              style={{ width: `${(done / checklist.length) * 100}%` }}
            />
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {remaining.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-panel px-3.5 text-sm font-medium text-ink transition-colors hover:border-forest/30 hover:bg-accent lg:min-h-9"
                >
                  <Plus className="size-3.5 text-brand-ink" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function AboutSection({ profile, first }: { profile: PublicProfile; first: string }) {
  const isOwner = profile.viewerState.isOwner;
  const facts: Array<{ key: string; icon: ReactNode; label: ReactNode; srLabel: string }> = [
    {
      key: "joined",
      icon: <CalendarDays className="size-4" aria-hidden="true" />,
      label: `Joined ${formatMonthYear(profile.joinedAt)}`,
      srLabel: "Member since",
    },
  ];
  if (profile.languages.length)
    facts.push({
      key: "languages",
      icon: <Languages className="size-4" aria-hidden="true" />,
      label: `Speaks ${profile.languages.join(", ")}`,
      srLabel: "Languages",
    });
  if (profile.contact.email)
    facts.push({
      key: "email",
      icon: <Mail className="size-4" aria-hidden="true" />,
      label: (
        <a href={`mailto:${profile.contact.email}`} className="underline-offset-4 hover:text-ink hover:underline">
          {profile.contact.email}
        </a>
      ),
      srLabel: "Email",
    });
  if (profile.contact.phone)
    facts.push({
      key: "phone",
      icon: <Phone className="size-4" aria-hidden="true" />,
      label: (
        <a href={`tel:${profile.contact.phone.replace(/\s+/g, "")}`} className="underline-offset-4 hover:text-ink hover:underline">
          {profile.contact.phone}
        </a>
      ),
      srLabel: "Phone",
    });

  return (
    <Section id="about" title={isOwner ? "About you" : `About ${first}`}>
      {profile.bio?.trim() ? (
        <p className="max-w-[68ch] whitespace-pre-line text-[15px] leading-7 text-ink/85">{profile.bio}</p>
      ) : isOwner ? (
        <p className="text-sm leading-6 text-muted-foreground">
          A line or two about who you are and what you list helps people decide to reach out.{" "}
          <Link href="/profile/edit" className="font-semibold text-brand-ink underline-offset-4 hover:underline">
            Write your bio
          </Link>
        </p>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">{first} hasn&apos;t written a bio yet.</p>
      )}
      <dl className="mt-5 flex flex-wrap gap-2">
        {facts.map((fact) => (
          <div
            key={fact.key}
            className="inline-flex min-h-9 min-w-0 max-w-full items-center gap-2 rounded-full border border-border bg-panel px-3.5 py-1.5 text-sm text-muted-foreground"
          >
            <dt className="sr-only">{fact.srLabel}</dt>
            <span className="shrink-0 text-brand-ink">{fact.icon}</span>
            <dd className="min-w-0 [overflow-wrap:anywhere]">{fact.label}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function ReviewsSection({ profile, first }: { profile: PublicProfile; first: string }) {
  const isOwner = profile.viewerState.isOwner;
  const { publishedCount, average } = profile.reviewSummary;
  const hidden = publishedCount > 0 && profile.reviews.length === 0;

  return (
    <Section
      id="reviews"
      title="Reviews"
      meta={
        publishedCount ? (
          <span className="inline-flex items-center gap-1.5">
            {average !== null ? (
              <>
                <Star className="size-4 fill-current text-selection" aria-hidden="true" />
                <span className="font-semibold text-ink">{average.toFixed(1)}</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            {publishedCount} {publishedCount === 1 ? "review" : "reviews"}
          </span>
        ) : null
      }
    >
      {profile.reviews.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {profile.reviews.map((review) => (
            <li key={review.id} className="flex flex-col rounded-[20px] border border-border bg-panel p-5 shadow-[var(--elevation-1)]">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${review.overall} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      className={cn("size-4", index < review.overall ? "fill-current text-selection" : "text-border")}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                {review.publishedAt ? (
                  <span className="text-xs text-muted-foreground">{formatMonthYear(review.publishedAt)}</span>
                ) : null}
              </div>
              {review.body ? (
                <p className="mt-3 flex-1 text-sm leading-6 text-ink/85">{review.body}</p>
              ) : (
                <p className="mt-3 flex-1 text-sm italic leading-6 text-muted-foreground">Rated without a written review.</p>
              )}
              <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-status-success-text">
                <BadgeCheck className="size-3.5" aria-hidden="true" />
                Verified interaction
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyPanel
          icon={<MessageSquareQuote className="size-5" aria-hidden="true" />}
          title={hidden ? "Reviews are private" : "No reviews yet"}
          body={
            hidden
              ? `${first} has chosen not to show reviews on their profile.`
              : isOwner
                ? "Reviews come only from people you've completed a real interaction with, like a viewing or an application."
                : `Reviews come only from people who've completed a real interaction with ${first}, like a viewing or an application.`
          }
        />
      )}
    </Section>
  );
}

function Section({ id, title, meta, children }: { id: string; title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-heading`} className="text-xl font-semibold tracking-tight text-ink sm:text-[22px]">
          {title}
        </h2>
        {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyPanel({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[20px] border border-dashed border-border bg-panel/60 p-6 sm:flex-row sm:items-center">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-brand-ink">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 max-w-[60ch] text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}

function Notice({ icon, children, className }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-[16px] border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-text",
        className,
      )}
    >
      <span className="mt-1 shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  );
}

/** A members-only profile seen by a guest: say why, and offer the way in. */
export function ProfileSignInRequired({ username }: { username: string }) {
  const href = `/auth?redirect=${encodeURIComponent(`/u/${username}`)}`;
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 pb-28 pt-10 text-foreground sm:pb-10">
      <section className="w-full max-w-md overflow-hidden rounded-[24px] border border-border bg-panel text-center shadow-[var(--elevation-2)]">
        <div aria-hidden="true" className="h-20 bg-surface-chrome bg-[radial-gradient(80%_140%_at_50%_0%,color-mix(in_oklch,var(--brand-amber)_45%,transparent),transparent_70%)]" />
        <div className="px-6 pb-7">
          <span className="mx-auto -mt-7 grid size-14 place-items-center rounded-full border-4 border-panel bg-selection text-selection-foreground">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">Sign in to view this profile</h1>
          <p className="mx-auto mt-2 max-w-[36ch] text-sm leading-6 text-muted-foreground">
            This member shares their profile with signed-in Pinpoint members only.
          </p>
          <div className="mt-6 grid gap-2">
            <Link
              href={href}
              prefetch={false}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-control)] transition-colors hover:bg-[var(--forest-hover)]"
            >
              Sign in
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-muted-foreground transition-colors hover:text-ink"
            >
              Back to map
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
