import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  FileText,
  Heart,
  Home,
  MessageCircle,
  Star,
} from "lucide-react";

import { PageHeader, StatusBadge } from "@/components/premium/primitives";
import { PersonaSwitcher } from "@/features/profile/components/persona-switcher";
import { getProfileDashboardData } from "@/features/profile/data";
import { marketplacePersonaLabels } from "@/lib/personas";

export const metadata: Metadata = {
  title: "Your Profile",
  robots: { index: false, follow: false },
};

const countCards = [
  ["applications", "Applications", "/applications", FileText],
  ["purchases", "Purchases", "/purchases", Home],
  ["viewings", "Viewings", "/viewings", CalendarDays],
  ["messages", "Messages", "/messages", MessageCircle],
  [
    "notifications",
    "Notifications",
    "/profile/activity?category=notification",
    Bell,
  ],
  ["saved", "Saved homes", "/saved", Heart],
] as const;

export default async function ProfilePage() {
  const { profile, counts, activity, verification } =
    await getProfileDashboardData();
  const active =
    profile.personas.find((persona) => persona.isActive) ?? profile.personas[0];
  const verified = verification.filter(
    (check) => check.status === "verified",
  ).length;
  const verificationTotal = 12;
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
        description="Your identity, trust evidence, and marketplace work in one place."
        action={<PersonaSwitcher personas={profile.personas} />}
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
              <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">
                {profile.displayName}
              </h1>
              {active ? (
                <StatusBadge tone="forest">
                  {marketplacePersonaLabels[active.persona]}
                </StatusBadge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              @{profile.username}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/profile/edit"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-forest px-4 text-sm font-semibold text-primary-foreground hover:bg-forest/90"
              >
                Complete profile <ArrowRight className="size-4" />
              </Link>
              <Link
                href={`/u/${profile.username}`}
                className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-ink hover:bg-muted"
              >
                View public profile
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="grid size-20 place-items-center rounded-full"
              style={{
                background: `conic-gradient(var(--forest) ${active?.completion ?? 0}%, var(--border) 0)`,
              }}
              aria-label={`${active?.completion ?? 0}% profile complete`}
            >
              <div className="grid size-16 place-items-center rounded-full bg-panel text-center">
                <span className="text-lg font-semibold text-ink">
                  {active?.completion ?? 0}%
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

      <section aria-labelledby="profile-work-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
              Your work
            </p>
            <h2
              id="profile-work-heading"
              className="mt-2 text-xl font-semibold text-ink"
            >
              Marketplace activity
            </h2>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 border-l border-t border-border sm:grid-cols-3">
          {countCards.map(([key, label, href, Icon]) => (
            <Link
              key={key}
              href={href}
              className="group min-h-28 border-b border-r border-border bg-panel p-4 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <Icon className="size-4 text-forest" />
              <p className="mt-4 text-2xl font-semibold text-ink">
                {counts[key]}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground group-hover:text-ink">
                {label}
              </p>
            </Link>
          ))}
        </div>
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
              className="h-full rounded-full bg-forest"
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
