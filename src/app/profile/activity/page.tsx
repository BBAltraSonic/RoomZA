import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader, StatusBadge } from "@/components/premium/primitives";
import { getProfileActivityPage } from "@/features/profile/data";

export const metadata: Metadata = {
  title: "Profile Activity",
  robots: { index: false, follow: false },
};

const categories = [
  "all",
  "application",
  "viewing",
  "message",
  "offer",
  "document",
  "review",
  "verification",
  "listing",
  "security",
] as const;

export default async function ProfileActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; before?: string }>;
}) {
  const { category = "all", before } = await searchParams;
  const events = await getProfileActivityPage(category, before);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Private history"
        title="Activity"
        description="A private, chronological record of important marketplace actions."
      />
      <nav
        aria-label="Activity categories"
        className="flex gap-2 overflow-x-auto pb-2"
      >
        {categories.map((item) => (
          <Link
            key={item}
            href={
              item === "all"
                ? "/profile/activity"
                : `/profile/activity?category=${item}`
            }
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${category === item ? "border-forest bg-accent text-forest" : "border-border text-muted-foreground hover:text-ink"}`}
          >
            {item.replaceAll("_", " ")}
          </Link>
        ))}
      </nav>
      {events.length ? (
        <ol className="border-y border-border">
          {events.map((event) => (
            <li
              key={event.id}
              className="grid gap-2 border-b border-border py-5 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-start"
            >
              <time className="text-xs font-medium text-muted-foreground">
                {new Intl.DateTimeFormat("en-ZA", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(event.occurredAt))}
              </time>
              <div>
                <p className="text-sm font-semibold text-ink">{event.title}</p>
                {event.summary ? (
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {event.summary}
                  </p>
                ) : null}
              </div>
              <StatusBadge
                tone={event.visibility === "public" ? "forest" : "neutral"}
              >
                {event.visibility}
              </StatusBadge>
            </li>
          ))}
        </ol>
      ) : (
        <div className="border-y border-border py-12 text-center">
          <p className="text-sm font-semibold text-ink">
            No activity in this category
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Events appear here after an application, viewing, message, offer,
            profile, document, review, or verification action.
          </p>
        </div>
      )}
      {events.length === 30 ? (
        <Link
          href={`/profile/activity?category=${category}&before=${encodeURIComponent(events.at(-1)!.occurredAt)}`}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-ink"
        >
          Load older activity
        </Link>
      ) : null}
    </div>
  );
}
