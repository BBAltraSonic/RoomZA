import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CheckCircle2, Star } from "lucide-react";

import { PageHeader, StatusBadge } from "@/components/premium/primitives";
import { getProfileDashboardData } from "@/features/profile/data";

export const metadata: Metadata = {
  title: "Your Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const { profile, attention, activity, verification } =
    await getProfileDashboardData();
  const active =
    profile.personas.find((persona) => persona.isActive) ?? profile.personas[0];
  const verified = verification.filter(
    (check) => check.status === "verified",
  ).length;
  const verificationTotal = 12;
  const completion = active?.completion ?? 0;
  const initials = profile.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Private profile"
        title={`Welcome back, ${profile.displayName.split(" ")[0]}`}
        description="Your identity, trust evidence, and what is waiting on you."
      />

      <section className="border-y border-border py-6 sm:rounded-2xl sm:border sm:bg-panel sm:p-6 sm:shadow-[var(--elevation-1)]">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-accent text-xl font-semibold text-forest">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-semibold tracking-tight text-ink">
                {profile.displayName}
              </h2>

            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              @{profile.username}
            </p>
            {/* One primary action, and only while there is something left to complete. */}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {completion < 100 ? (
                <Link
                  href="/profile/edit"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-forest px-4 text-sm font-semibold text-primary-foreground hover:bg-forest/90"
                >
                  Complete profile <ArrowRight className="size-4" />
                </Link>
              ) : null}
              <Link
                href={`/u/${profile.username}`}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline-offset-4 hover:underline"
              >
                View public profile
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="grid size-20 place-items-center rounded-full"
              style={{
                background: `conic-gradient(var(--selection) ${completion}%, var(--border) 0)`,
              }}
              aria-label={`${completion}% profile complete`}
            >
              <div className="grid size-16 place-items-center rounded-full bg-panel text-center">
                <span className="text-lg font-semibold text-ink">
                  {completion}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                Profile completion
              </p>
              <p className="mt-1 max-w-40 text-xs leading-5 text-muted-foreground">
                Required fields only. Verification is tracked separately.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="text-xl font-semibold text-ink">
          Needs your attention
        </h2>
        {attention.items.length ? (
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-[var(--radius-panel)] border border-border bg-panel">
            {attention.items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  {item.label}
                  <ArrowRight className="size-4 shrink-0 text-forest" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : attention.incomplete ? null : (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-forest" aria-hidden="true" />
            You&apos;re all caught up.
          </p>
        )}
        {attention.incomplete ? (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            Some items could not load. Refresh the page to check again.
          </p>
        ) : null}
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <section aria-labelledby="verification-heading">
          <div className="flex items-center justify-between gap-4">
            <div>
              <BadgeCheck className="size-5 text-forest" />
              <h2
                id="verification-heading"
                className="mt-3 text-xl font-semibold text-ink"
              >
                Verification
              </h2>
            </div>
            <StatusBadge tone={verified > 0 ? "success" : "neutral"}>
              {verified}/{verificationTotal}
            </StatusBadge>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-selection"
              style={{ width: `${(verified / verificationTotal) * 100}%` }}
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Verification builds explainable trust without creating a hidden
            score.
          </p>
          <Link
            href="/profile/verification"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-forest"
          >
            Review verification <ArrowRight className="size-4" />
          </Link>
        </section>

        <section aria-labelledby="recent-heading">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Star className="size-5 text-forest" />
              <h2
                id="recent-heading"
                className="mt-3 text-xl font-semibold text-ink"
              >
                Recent activity
              </h2>
            </div>
            <Link
              href="/profile/activity"
              className="text-sm font-semibold text-forest"
            >
              See all
            </Link>
          </div>
          {activity.length ? (
            <ol className="mt-3 divide-y divide-border border-y border-border">
              {activity.slice(0, 4).map((event) => (
                <li key={event.id} className="py-3">
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
            </ol>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Your private activity stream will appear as you use Pinpoint.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
