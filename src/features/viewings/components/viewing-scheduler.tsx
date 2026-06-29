"use client";

import { CalendarClock, MapPin, Video } from "lucide-react";
import Link from "next/link";

import { EmptyState, StatusBadge } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";

export type ViewingData = {
  proposed: {
    id: string;
    start_time: string;
    end_time: string;
    mode: string;
    is_booked: boolean;
    listing?: { title?: string | null; address?: string | null } | null;
    offers?: { application?: { full_name?: string | null } | null }[] | null;
  }[];
  booked: {
    id: string;
    status: string;
    meeting_join_url?: string | null;
    application?: {
      full_name?: string | null;
      listing?: { title?: string | null; address?: string | null } | null;
    } | null;
    slot?: { start_time?: string | null; end_time?: string | null; mode?: string | null } | null;
  }[];
};

function formatDate(value?: string | null) {
  if (!value) return "No time";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ViewingScheduler({ data }: { data: ViewingData }) {
  const hasViewings = data.proposed.length > 0 || data.booked.length > 0;

  if (!hasViewings) {
    return <EmptyState icon={CalendarClock} title="No viewings yet" description="Viewing proposals and booked appointments will appear here once applicants are ready to schedule." />;
  }

  const scheduledViewings = data.booked.filter(v => v.status === "booked");
  const pastViewings = data.booked.filter(v => v.status === "completed" || v.status === "cancelled");

  return (
    <div className="grid gap-4">
      {data.proposed.length > 0 ? (
        <section className="rounded-lg border border-border bg-panel p-4 shadow-[var(--elevation-1)]">
          <h2 className="text-base font-semibold text-ink">Proposed slots</h2>
          <div className="mt-3 grid gap-3">
            {data.proposed.map((slot) => (
              <article key={slot.id} className="rounded-md border border-border bg-warm-surface p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-ink">{slot.listing?.title ?? "Listing"}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(slot.start_time)} to {formatDate(slot.end_time)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      {slot.mode === "video_call" ? (
                        <>
                          <Video className="size-3.5" /> Video call
                        </>
                      ) : (
                        <>
                          <MapPin className="size-3.5" /> In person
                        </>
                      )}
                      <span>·</span>
                      <span>{slot.offers?.length ?? 0} applicants offered</span>
                    </p>
                  </div>
                  <StatusBadge tone={slot.is_booked ? "success" : "info"}>{slot.is_booked ? "booked" : "proposed"}</StatusBadge>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {scheduledViewings.length > 0 ? (
        <section className="rounded-lg border border-border bg-panel p-4 shadow-[var(--elevation-1)]">
          <h2 className="text-base font-semibold text-ink">Scheduled viewings</h2>
          <div className="mt-3 grid gap-3">
            {scheduledViewings.map((viewing) => (
              <article key={viewing.id} className="rounded-md border border-border bg-warm-surface p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-ink">{viewing.application?.full_name ?? "Applicant"}</p>
                    <p className="text-sm text-muted-foreground">{viewing.application?.listing?.title ?? "Listing"}</p>
                    <p className="mt-1 text-sm font-medium text-ink">{formatDate(viewing.slot?.start_time)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      {viewing.slot?.mode === "video_call" ? (
                        <>
                          <Video className="size-3.5" /> Video call
                        </>
                      ) : (
                        <>
                          <MapPin className="size-3.5" /> In person
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge tone="forest">booked</StatusBadge>
                    {viewing.slot?.mode === "video_call" ? (
                      <Button render={<Link href={`/viewings/${viewing.id}/live`} />} size="sm" className="bg-forest text-primary-foreground hover:bg-forest/90">
                        <Video className="size-3.5" />
                        Join
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {pastViewings.length > 0 ? (
        <section className="rounded-lg border border-border bg-panel p-4 shadow-[var(--elevation-1)]">
          <h2 className="text-base font-semibold text-ink">Past viewings</h2>
          <div className="mt-3 grid gap-3">
            {pastViewings.map((viewing) => (
              <article key={viewing.id} className="rounded-md border border-border bg-warm-surface p-3 opacity-80 transition-opacity hover:opacity-100">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-ink">{viewing.application?.full_name ?? "Applicant"}</p>
                    <p className="text-sm text-muted-foreground">{viewing.application?.listing?.title ?? "Listing"}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(viewing.slot?.start_time)}</p>
                  </div>
                  <StatusBadge tone={viewing.status === "cancelled" ? "error" : "neutral"}>{viewing.status}</StatusBadge>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
