"use client";

import {
  ArrowLeft,
  CalendarClock,
  Check,
  CircleStop,
  Radio,
  ShieldCheck,
  Users,
  VideoOff,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PendingGlyph } from "@/lib/motion/primitives";
import { createClient } from "@/lib/supabase/browser";

import {
  cancelScheduledLiveTour,
  endLiveTour,
  finishLiveTourRecording,
  saveLiveTourRecordingLink,
  setLiveTourRecordingConsent,
  startLiveTourRecording,
  startScheduledLiveTour,
} from "./actions";
import type { InstantConnectPhase3Flags } from "./feature-flags";
import {
  LiveTourVideo,
  type JitsiExternalApi,
} from "./live-tour-video";
import {
  getViewerQueue,
  getViewerRoster,
  readTourPresence,
} from "./presence-state";
import { formatLiveTourSchedule } from "./schedule";
import type {
  LiveTour,
  LiveTourWithListing,
  TourPresenceEntry,
} from "./types";

type ConsentRow = {
  user_id: string;
  granted: boolean;
};

export function LiveTourRoom({
  tour,
  currentUserId,
  currentUserName,
  flags,
}: {
  tour: LiveTourWithListing;
  currentUserId: string;
  currentUserName: string;
  flags: InstantConnectPhase3Flags;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const participantKey = useMemo(() => crypto.randomUUID(), []);
  const videoApiRef = useRef<JitsiExternalApi | null>(null);
  const peakViewersRef = useRef(tour.peak_viewers);
  const recordingStatusRef = useRef(tour.recording_status);
  const isHost = currentUserId === tour.host_id;
  const [status, setStatus] = useState<LiveTour["status"]>(tour.status);
  const [recordingStatus, setRecordingStatus] = useState(
    tour.recording_status,
  );
  const [presence, setPresence] = useState<TourPresenceEntry[]>([]);
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [conferenceParticipantId, setConferenceParticipantId] = useState<
    string | undefined
  >();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const queue = getViewerQueue(presence, participantKey);
  const viewerRoster = getViewerRoster(presence);
  const activeViewerIds = [
    ...new Set(
      viewerRoster
        .map((entry) => entry.userId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const requiredConsentIds = [...new Set([currentUserId, ...activeViewerIds])];
  const consentedIds = new Set(
    consents.filter((consent) => consent.granted).map((consent) => consent.user_id),
  );
  const ownConsent = consentedIds.has(currentUserId);
  const missingConsentCount = requiredConsentIds.filter(
    (id) => !consentedIds.has(id),
  ).length;

  useEffect(() => {
    recordingStatusRef.current = recordingStatus;
  }, [recordingStatus]);

  useEffect(() => {
    peakViewersRef.current = Math.max(
      peakViewersRef.current,
      queue.viewerCount,
    );
  }, [queue.viewerCount]);

  const refreshConsents = useCallback(async () => {
    if (!flags.recording) return;
    const { data } = await supabase
      .from("live_tour_recording_consents")
      .select("user_id, granted")
      .eq("tour_id", tour.id)
      .limit(250);
    setConsents(data ?? []);
  }, [flags.recording, supabase, tour.id]);

  useEffect(() => {
    if (!["scheduled", "live"].includes(status)) return;

    const isLive = status === "live";
    const channel = supabase.channel(
      isLive ? `presence:tour:${tour.id}` : `tour-status:${tour.id}`,
      isLive
        ? {
            config: {
              private: true,
              presence: { key: participantKey },
            },
          }
        : undefined,
    );

    if (isLive) {
      channel.on("presence", { event: "sync" }, () => {
        setPresence(readTourPresence(channel.presenceState()));
      });
      if (flags.recording) {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "live_tour_recording_consents",
            filter: `tour_id=eq.${tour.id}`,
          },
          () => void refreshConsents(),
        );
      }
    }

    channel
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_tours",
          filter: `id=eq.${tour.id}`,
        },
        (payload) => {
          const next = payload.new as Partial<LiveTour>;
          if (next.status) setStatus(next.status);
          if (next.recording_status) {
            setRecordingStatus(next.recording_status);
          }
        },
      )
      .subscribe(async (subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED" && isLive) {
          await channel.track({
            role: isHost ? "host" : "viewer",
            joinedAt: new Date().toISOString(),
            userId: currentUserId,
            displayName: currentUserName,
            conferenceParticipantId,
          });
          await refreshConsents();
        }
        if (
          subscriptionStatus === "CHANNEL_ERROR"
          || subscriptionStatus === "TIMED_OUT"
        ) {
          setError(
            "Live roster updates are unavailable. The video room still works.",
          );
        }
      });

    return () => {
      if (isLive) void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [
    conferenceParticipantId,
    currentUserId,
    currentUserName,
    flags.recording,
    isHost,
    participantKey,
    refreshConsents,
    status,
    supabase,
    tour.id,
  ]);

  useEffect(() => {
    if (!["scheduled", "live"].includes(status)) return;

    let disposed = false;
    const refreshStatus = async () => {
      const { data } = await supabase.rpc("get_public_live_tour_status", {
        target_tour_id: tour.id,
      });
      const nextStatus = data?.[0]?.status;
      if (!disposed && nextStatus && nextStatus !== status) {
        setStatus(nextStatus);
      }
    };
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 5_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshStatus();
    };

    void refreshStatus();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [status, supabase, tour.id]);

  useEffect(() => {
    if (
      !isHost
      || recordingStatus !== "recording"
      || missingConsentCount === 0
    ) {
      return;
    }

    videoApiRef.current?.executeCommand("stopRecording", "file", false);
    void finishLiveTourRecording(
      tour.id,
      "failed",
      "Recording stopped because an active participant had not consented.",
    ).then((result) => {
      if (result.success) {
        setRecordingStatus("failed");
        setError(
          "Recording stopped because every active participant must consent.",
        );
      }
    });
  }, [
    isHost,
    missingConsentCount,
    recordingStatus,
    tour.id,
  ]);

  function runHostTourAction(
    work: () => Promise<
      | { success: true; data: { tour: LiveTour } }
      | { success: true; data: { status: "cancelled" } }
      | { success: false; error: string }
    >,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.success) {
        setError(result.error);
        return;
      }
      if ("tour" in result.data) setStatus("live");
      else setStatus("cancelled");
      router.refresh();
    });
  }

  const handleEnd = () => {
    setError(null);
    startTransition(async () => {
      if (recordingStatus === "recording") {
        videoApiRef.current?.executeCommand("stopRecording", "file", false);
      }
      const result = await endLiveTour(tour.id, peakViewersRef.current);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setStatus("ended");
      router.refresh();
    });
  };

  const handleConferenceJoined = useCallback((participantId: string) => {
    setConferenceParticipantId(participantId);
  }, []);

  const handleRecordingStatusChanged = useCallback((event: {
    on: boolean;
    mode: string;
    error?: string;
  }) => {
    if (!isHost || event.mode !== "file") return;
    if (event.error) {
      void finishLiveTourRecording(tour.id, "failed", event.error).then(
        (result) => {
          if (result.success) setRecordingStatus("failed");
        },
      );
      return;
    }
    if (!event.on && recordingStatusRef.current === "recording") {
      void finishLiveTourRecording(tour.id, "stopped").then((result) => {
        if (result.success) setRecordingStatus("stopped");
      });
    }
  }, [isHost, tour.id]);

  const handleRecordingLinkAvailable = useCallback((event: {
    link: string;
    ttl?: number;
  }) => {
    if (!isHost || !event.link) return;
    void saveLiveTourRecordingLink(tour.id, {
      url: event.link,
      externalId: event.ttl ? `ttl:${event.ttl}` : null,
    });
  }, [isHost, tour.id]);

  if (status === "scheduled" && tour.scheduled_at) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground">
        <section className="w-full max-w-xl rounded-2xl border border-border bg-panel p-7 shadow-[var(--elevation-2)]">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-forest">
            <CalendarClock className="size-4" aria-hidden="true" />
            Scheduled open house
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-ink">
            {tour.listing.title}
          </h1>
          <p className="mt-2 text-base font-semibold text-ink">
            {formatLiveTourSchedule(tour.scheduled_at, "full")}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isHost
              ? "You can open the room from 30 minutes before the scheduled time."
              : "This page will open the video room automatically when the host starts the tour."}
          </p>
          {error ? (
            <p
              className="mt-4 rounded-xl border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm text-status-warning-text"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2">
            {isHost ? (
              <>
                <Button
                  type="button"
                  className="min-h-11 sm:min-h-10"
                  disabled={pending}
                  onClick={() =>
                    runHostTourAction(() => startScheduledLiveTour(tour.id))
                  }
                >
                  {pending
                    ? <PendingGlyph label="Starting open house" />
                    : <Radio className="size-4" aria-hidden="true" />}
                  Start open house
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 sm:min-h-10"
                  disabled={pending}
                  onClick={() =>
                    runHostTourAction(() => cancelScheduledLiveTour(tour.id))
                  }
                >
                  Cancel
                </Button>
              </>
            ) : null}
            <Button
              render={<Link href={`/?listingId=${tour.listing_id}`} />}
              variant="outline"
              className="min-h-11 sm:min-h-10"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to listing
            </Button>
          </div>
        </section>
      </main>
    );
  }

  if (status === "ended" || status === "cancelled") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
        <section className="w-full max-w-lg rounded-2xl border border-border bg-panel p-7 text-center shadow-[var(--elevation-2)]">
          <VideoOff className="mx-auto size-9 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold text-ink">
            {status === "cancelled"
              ? "This open house was cancelled"
              : "This live tour has ended"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Return to the listing to message the landlord or arrange a viewing.
          </p>
          <Button
            render={<Link href={`/?listingId=${tour.listing_id}`} />}
            className="mt-6 min-h-11 bg-forest text-primary-foreground hover:bg-forest/90 sm:min-h-10"
          >
            Back to listing
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background px-3 pb-5 pt-3 text-foreground sm:px-5 sm:pt-5">
      <div className="mx-auto max-w-7xl">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-panel px-4 py-3 shadow-[var(--elevation-1)]">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              render={<Link href={`/?listingId=${tour.listing_id}`} />}
              variant="outline"
              size="icon"
              className="size-11 sm:size-10"
              aria-label="Back to listing"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-status-error-text">
                  <Radio className="size-3.5" aria-hidden="true" />
                  Live tour
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
                  <Users className="size-3.5" aria-hidden="true" />
                  {queue.viewerCount} {queue.viewerCount === 1 ? "viewer" : "viewers"}
                </span>
              </div>
              <h1 className="truncate text-base font-semibold text-ink">
                {tour.listing.title}
              </h1>
            </div>
          </div>

          {isHost ? (
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 sm:min-h-10"
              onClick={handleEnd}
              disabled={pending}
            >
              {pending
                ? <PendingGlyph label="Ending live tour" />
                : <VideoOff className="size-4" aria-hidden="true" />}
              End tour
            </Button>
          ) : queue.queuePosition ? (
            <p className="rounded-full bg-accent px-3 py-2 text-xs font-semibold text-forest">
              You joined as viewer {queue.queuePosition}
            </p>
          ) : null}
        </header>

        {error ? (
          <p
            className="mb-3 rounded-xl border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm text-status-warning-text"
            role="status"
          >
            {error}
          </p>
        ) : null}

        {flags.recording ? (
          <section className="mb-3 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-panel px-4 py-3 shadow-[var(--elevation-1)]">
            <div className="min-w-0">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <ShieldCheck className="size-4 text-forest" aria-hidden="true" />
                Optional recording
              </h2>
              <p className="mt-1 max-w-[65ch] text-xs leading-5 text-muted-foreground">
                Recording starts only after the host and every active viewer explicitly consent. Consent can be withdrawn at any time.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={ownConsent ? "secondary" : "outline"}
                className="min-h-11 sm:min-h-10"
                disabled={pending || recordingStatus === "recording"}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await setLiveTourRecordingConsent(
                      tour.id,
                      !ownConsent,
                    );
                    if (!result.success) {
                      setError(result.error);
                      return;
                    }
                    await refreshConsents();
                    toast.success(
                      result.data.granted
                        ? "Recording consent saved"
                        : "Recording consent withdrawn",
                    );
                  });
                }}
              >
                {ownConsent
                  ? <Check className="size-4" aria-hidden="true" />
                  : <ShieldCheck className="size-4" aria-hidden="true" />}
                {ownConsent ? "Consented" : "I consent"}
              </Button>
              {isHost ? (
                recordingStatus === "recording" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="min-h-11 sm:min-h-10"
                    onClick={() =>
                      videoApiRef.current?.executeCommand(
                        "stopRecording",
                        "file",
                        false,
                      )
                    }
                  >
                    <CircleStop className="size-4" aria-hidden="true" />
                    Stop recording
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="min-h-11 sm:min-h-10"
                    disabled={
                      pending
                      || activeViewerIds.length === 0
                      || missingConsentCount > 0
                    }
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        const result = await startLiveTourRecording(
                          tour.id,
                          activeViewerIds,
                        );
                        if (!result.success) {
                          setError(result.error);
                          return;
                        }
                        setRecordingStatus("recording");
                        videoApiRef.current?.executeCommand(
                          "startRecording",
                          {
                            mode: "file",
                            shouldShare: true,
                            extraMetadata: { tourId: tour.id },
                          },
                        );
                      });
                    }}
                  >
                    <Radio className="size-4" aria-hidden="true" />
                    {missingConsentCount > 0
                      ? `Waiting for ${missingConsentCount}`
                      : "Start recording"}
                  </Button>
                )
              ) : null}
            </div>
          </section>
        ) : null}

        <LiveTourVideo
          joinUrl={tour.join_url}
          roomId={tour.room_id}
          title={isHost ? `Hosting ${tour.listing.title}` : tour.listing.title}
          displayName={currentUserName}
          isHost={isHost}
          moderationEnabled={flags.moderation}
          pictureInPictureEnabled={flags.pictureInPicture}
          onConferenceJoined={handleConferenceJoined}
          onRecordingStatusChanged={handleRecordingStatusChanged}
          onRecordingLinkAvailable={handleRecordingLinkAvailable}
          apiRef={videoApiRef}
        />
      </div>
    </main>
  );
}
