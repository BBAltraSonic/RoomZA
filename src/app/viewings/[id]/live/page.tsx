import { notFound, redirect } from "next/navigation";
import { CalendarClock, Home, Video } from "lucide-react";

import { AppShell, BackLink, PageHeader, StatusBadge } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";
import { getLiveViewing } from "@/features/viewings/actions/live-viewing";
import { LiveVideoViewing } from "@/features/viewings/components/live-video-viewing";
import { authPathForRedirect } from "@/lib/redirects";

function getFirst<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function LiveViewingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, viewing } = await getLiveViewing(id);

  if (!user) {
    redirect(authPathForRedirect(`/viewings/${id}/live`));
  }

  if (!viewing) {
    notFound();
  }

  const slot = getFirst(viewing.slot);
  const application = getFirst(viewing.application);
  const listing = getFirst(application?.listing);

  if (!slot || !application || !listing) {
    notFound();
  }

  const isVideoViewing = slot.mode === "video_call";
  const startsAt = viewing.meeting_starts_at ?? slot.start_time;
  const endsAt = viewing.meeting_ends_at ?? slot.end_time;
  const now = new Date().getTime();
  const joinOpensAt = new Date(startsAt).getTime() - 10 * 60 * 1000;
  const joinClosesAt = new Date(endsAt).getTime() + 2 * 60 * 60 * 1000;
  const canJoin = viewing.status === "booked" && isVideoViewing && now >= joinOpensAt && now <= joinClosesAt;
  const videoRoomMessage =
    now < joinOpensAt
      ? `The room opens 10 minutes before ${formatDateTime(startsAt)}.`
      : now > joinClosesAt
        ? "This video viewing window has ended."
        : "This video viewing is not available.";
  const backUrl = listing.landlord_id === user.id ? `/dashboard/listings/${listing.id}/applicants` : "/applications";

  return (
    <AppShell width="xl" className="pt-2 md:pt-20">
      <BackLink href={backUrl} />

      <PageHeader
        eyebrow="Viewing"
        title={listing.title}
        description={listing.address}
        action={
          <StatusBadge tone={isVideoViewing ? "forest" : "neutral"} icon>
            {isVideoViewing ? "Video call" : "In-person"}
          </StatusBadge>
        }
      />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {isVideoViewing && viewing.meeting_join_url && viewing.meeting_room_id && canJoin ? (
            <LiveVideoViewing joinUrl={viewing.meeting_join_url} roomId={viewing.meeting_room_id} title={listing.title} />
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-border bg-panel p-8 text-center shadow-[var(--elevation-1)]">
              <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-warm-surface text-forest">
                {isVideoViewing ? <Video className="size-5" /> : <Home className="size-5" />}
              </div>
              <h2 className="mt-5 text-xl font-semibold text-ink">
                {isVideoViewing ? "Video room not open" : "In-person viewing"}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {isVideoViewing
                  ? videoRoomMessage
                  : "This viewing is scheduled in person. Use messages to coordinate arrival details."}
              </p>
              {isVideoViewing && viewing.meeting_join_url ? (
                <Button variant="outline" className="mt-5 h-10" disabled>
                  <Video className="size-4" />
                  Join video room
                </Button>
              ) : null}
            </div>
          )}
        </div>

        <aside className="rounded-lg border border-border bg-panel p-5 shadow-[var(--elevation-1)]">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <CalendarClock className="size-5 text-forest" />
            <div>
              <h2 className="text-base font-semibold text-ink">Viewing details</h2>
              <p className="text-sm text-muted-foreground">{viewing.status}</p>
            </div>
          </div>

          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="font-medium text-muted-foreground">Starts</dt>
              <dd className="mt-1 font-semibold text-ink">{formatDateTime(startsAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Ends</dt>
              <dd className="mt-1 font-semibold text-ink">{formatDateTime(endsAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Applicant</dt>
              <dd className="mt-1 font-semibold text-ink">{application.full_name}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Mode</dt>
              <dd className="mt-1 font-semibold text-ink">{isVideoViewing ? "Video call" : "In-person"}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </AppShell>
  );
}
