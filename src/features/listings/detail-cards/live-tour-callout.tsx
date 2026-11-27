import Link from "next/link";
import { CalendarDays, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatLiveTourSchedule } from "@/features/live-tours/schedule";

import type { ListingDetail } from "./types";

/** A live tour happening now links straight in; a scheduled one shows when it starts. */
export function LiveTourCallout({ listing }: { listing: Pick<ListingDetail, "liveTourId" | "upcomingLiveTour"> }) {
  if (listing.liveTourId) {
    return (
      <Button
        render={<Link href={`/live-tours/${listing.liveTourId}`} />}
        className="h-11 w-full border border-status-info-border bg-status-info-surface text-status-info-text hover:bg-status-info-surface/80"
      >
        <Video className="size-4" aria-hidden="true" />
        Join live video tour
      </Button>
    );
  }
  if (!listing.upcomingLiveTour) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-status-info-border bg-status-info-surface px-4 py-3 text-status-info-text">
      <span className="inline-flex items-center gap-2 text-sm font-semibold">
        <CalendarDays className="size-4" aria-hidden="true" />
        Live open house
      </span>
      <time dateTime={listing.upcomingLiveTour.scheduledAt} className="text-right text-xs font-semibold">
        {formatLiveTourSchedule(listing.upcomingLiveTour.scheduledAt, "compact")}
      </time>
    </div>
  );
}
