"use client";

import { CalendarClock, Clock3, Radio, Video } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LiveTourControls } from "@/features/live-tours/go-live-button";
import type { LiveTour } from "@/features/live-tours/types";
import { AvailabilityToggle } from "@/features/presence/availability-toggle";
import type { AvailabilityMode } from "@/features/presence/presence-status";

type InstantConnectPublisherProps = {
  availabilityMode: AvailabilityMode;
  listingId?: string;
  listingStatus?: string;
  upcomingTour?: LiveTour | null;
  scheduledToursEnabled?: boolean;
};

const signals = [
  {
    icon: Radio,
    title: "Available now",
    description: "Shown while you are reachable, using your availability setting below.",
  },
  {
    icon: Video,
    title: "Live video tour",
    description: "Shown automatically while you host a live tour for this property.",
  },
  {
    icon: CalendarClock,
    title: "Instant viewing",
    description: "Renters can request a near-term viewing when you are available; respond from your dashboard.",
  },
  {
    icon: Clock3,
    title: "Replies under 5 minutes",
    description: "Earned from your real response time, so renters can trust the signal.",
  },
];

export function InstantConnectPublisher({
  availabilityMode,
  listingId,
  listingStatus,
  upcomingTour,
  scheduledToursEnabled = false,
}: InstantConnectPublisherProps) {
  const isPublished = listingStatus === "published" && Boolean(listingId);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-panel shadow-[var(--elevation-1)]">
      <div className="px-5 py-5 sm:px-6">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-forest">
          Renter attraction
        </p>
        <h3 className="mt-2 text-lg font-bold tracking-tight text-ink">
          Make this listing Instant Connect ready
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Pinpoints adds renter-facing signals from real availability and activity. Set when
          you are reachable, then start or schedule a tour after publishing.
        </p>
      </div>

      <ul className="divide-y divide-border border-y border-border">
        {signals.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex gap-3 px-5 py-3.5 sm:px-6">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-forest">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <AvailabilityToggle currentMode={availabilityMode} />

        <div className="border-t border-border pt-5">
          <p className="text-sm font-semibold text-ink">Live tour</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {isPublished
              ? "Go live now. Interested renters see the live signal automatically."
              : "Publish this listing to unlock live tours and scheduled open houses."}
          </p>
          {isPublished && listingId ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <LiveTourControls
                listingId={listingId}
                upcomingTour={upcomingTour}
                scheduledEnabled={false}
              />
              {scheduledToursEnabled && !upcomingTour ? (
                <Button
                  render={<Link href={`/dashboard#listing-${listingId}`} />}
                  type="button"
                  variant="ghost"
                  className="min-h-11 text-muted-foreground sm:min-h-10"
                >
                  Schedule from Listings
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
