"use client";
import { useLatestRead } from "@/lib/hooks/use-latest-read";

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
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { actionFailure } from "@/lib/action-result";
import { useTourAction } from "./use-tour-action";
import { RECORDING_POLICY_VERSION } from "./recording-policy";
import { LiveTourTerminal } from "./live-tour-terminal";
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
  policy_version: string;
};

type LiveTourRoomProps = {
  tour: LiveTourWithListing;
  currentUserId: string;
  currentUserName: string;
  flags: InstantConnectPhase3Flags;
};
export function LiveTourRoom(props: LiveTourRoomProps) {
  const client = useMemo(() => createClient(), []);
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session) || (session && session.user.id !== props.currentUserId)) setSignedOut(true);
      else if (session?.user.id === props.currentUserId) setSignedOut(false);
    });
    return () => data.subscription.unsubscribe();
  }, [client, props.currentUserId]);
  if (signedOut) return <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground"><section className="w-full max-w-xl rounded-2xl border border-border bg-panel p-7"><h1 className="text-xl font-semibold text-ink">Access to this tour is unavailable.</h1><p className="mt-2 text-sm text-muted-foreground">Sign in again to check your access.</p><Button render={<Link href={`/listing/${props.tour.listing_id}`} />} className="mt-4" variant="outline">Back to listing</Button></section></main>;
  return <LiveTourRoomInstance key={props.tour.id + ":" + props.currentUserId} {...props} />;
}
function LiveTourRoomInstance({tour,currentUserId,currentUserName,flags}: LiveTourRoomProps) {
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
  const { error, setError, pending, run: runAction, isCurrent, setActive } = useTourAction();
  const [accessUnavailable, setAccessUnavailable] = useState(false);
  const [statusReadError, setStatusReadError] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const [providerStopFailed, setProviderStopFailed] = useState(false);
  const recordingRevision = useRef(0);
  const tourStatusRef = useRef(tour.status);
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
  const recordingParticipantKey = activeViewerIds.slice().sort().join(",");
  const consentedIds = new Set(
    consents.filter((consent) => consent.granted && consent.policy_version === RECORDING_POLICY_VERSION).map((consent) => consent.user_id),
  );
  const ownConsent = consentedIds.has(currentUserId);
  const missingConsentCount = requiredConsentIds.filter(
    (id) => !consentedIds.has(id),
  ).length;

  const stopProvider = useCallback(() => {
    try {
      if (!videoApiRef.current) throw new Error("Video connection unavailable");
      videoApiRef.current.executeCommand("stopRecording", "file", false);
      setProviderStopFailed(false);
      setError(current => current === "The recording stop could not be confirmed. Try stopping it again." ? null : current);
      return true;
    } catch {
      setProviderStopFailed(true);
      setError("The recording stop could not be confirmed. Try stopping it again.");
      return false;
    }
  }, [setError]);
  const updateRecording = useCallback((next: LiveTour["recording_status"]) => {
    if (!isCurrent()) return;
    const previous = recordingStatusRef.current;
    if (previous === next) return;
    recordingStatusRef.current = next;
    recordingRevision.current++;
    if (isHost && previous === "recording" && next !== "recording") stopProvider();
    setRecordingStatus(next);
  }, [isCurrent, isHost, stopProvider]);
  const updateTourStatus = useCallback((next: LiveTour["status"]) => {
    if (!isCurrent()) return;
    const order = { scheduled: 0, live: 1, ended: 2, cancelled: 2 };
    const current = tourStatusRef.current;
    if (order[next] < order[current] || (order[current] === 2 && next !== current)) return;
    tourStatusRef.current = next;
    if (isHost && order[next] === 2 && recordingStatusRef.current === "recording") stopProvider();
    setStatus(next);
  }, [isCurrent, isHost, stopProvider]);

  useEffect(() => {
    peakViewersRef.current = Math.max(
      peakViewersRef.current,
      queue.viewerCount,
    );
  }, [queue.viewerCount]);

  const beginConsentRead = useLatestRead(tour.id + ":" + String(flags.recording));
  const refreshConsents = useCallback(async () => {
    if (!flags.recording) return;
    const controller = beginConsentRead();
    try {
    const { data } = await supabase
      .from("live_tour_recording_consents")
      .select("user_id, granted, policy_version")
      .eq("tour_id", tour.id)
      .abortSignal(controller.signal).limit(250);
    if (!controller.signal.aborted) setConsents(data ?? []);
    } catch { /* Keep the current consent state when a refresh is unavailable. */ }
  }, [beginConsentRead, flags.recording, supabase, tour.id]);

  useEffect(() => {
    if (accessUnavailable || !["scheduled", "live"].includes(status)) return;

    let active = true;
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
        if (active) setPresence(readTourPresence(channel.presenceState()));
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
          () => { if (active) void refreshConsents(); },
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
          if (!active) return;
          const next = payload.new as Partial<LiveTour>;
          if (next.status) updateTourStatus(next.status);
          if (next.recording_status) {
            updateRecording(next.recording_status);
          }
        },
      )
      .subscribe(async (subscriptionStatus) => {
        if (!active) return;
        if (subscriptionStatus === "SUBSCRIBED" && isLive) {
          await channel.track({
            role: isHost ? "host" : "viewer",
            joinedAt: new Date().toISOString(),
            userId: currentUserId,
            displayName: currentUserName,
            conferenceParticipantId,
          });
          if (active) await refreshConsents();
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
      active = false;
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
    updateRecording,
    updateTourStatus,
    accessUnavailable,
    setError,
  ]);

  useEffect(() => {
    if (!["scheduled", "live"].includes(status)) return;

    let disposed = false;
    let sequence = 0;
    let reading = false;
    let controller: AbortController | null = null;
    const refreshStatus = async () => {
      if (reading || disposed) return;
      reading = true;
      const current = ++sequence;
      const readRecordingRevision = recordingRevision.current;
      controller = new AbortController();
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]);
      try {
      const { data, error: readError } = await supabase.from("live_tours")
        .select("status,recording_status").eq("id", tour.id)
        .abortSignal(signal).maybeSingle();
      if (disposed || current !== sequence) return;
      if (readError) throw readError;
      setStatusReadError(false);
      if (!data) {
        if (isHost && recordingStatusRef.current === "recording") stopProvider();
        setActive(false);
        setAccessUnavailable(true);
        const { data: finalState, error: finalStateError } = await supabase
          .rpc("get_live_tour_terminal_state", { target_tour_id: tour.id }).abortSignal(signal);
        if (disposed || current !== sequence) return;
        if (finalStateError) throw finalStateError;
        const terminal = finalState?.[0];
        if (terminal?.listing_id === tour.listing_id && (terminal.status === "ended" || terminal.status === "cancelled")) {
          setActive(true);
          updateTourStatus(terminal.status);
          setActive(false);
          setAccessUnavailable(false);
        }
        return;
      }
      setActive(true);
      setAccessUnavailable(false);
      if (readRecordingRevision === recordingRevision.current) updateRecording(data.recording_status);
      updateTourStatus(data.status);
      } catch {
        if (!disposed && current === sequence) setStatusReadError(true);
      } finally { reading = false; }
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
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isHost, readAttempt, setActive, status, stopProvider, supabase, tour.id, tour.listing_id, updateRecording, updateTourStatus]);

  const persistRecordingStop = useCallback(async (result: "stopped" | "failed", message?: string) => {
    try {
      const response = await finishLiveTourRecording(tour.id, result, message);
      if (!isCurrent()) return;
      if (response.success) updateRecording(response.data.status);
      else setError(response.error);
    } catch {
      if (isCurrent()) setError("The recording state could not be confirmed. Check the current status and try again.");
    }
  }, [isCurrent, setError, tour.id, updateRecording]);

  useEffect(() => {
    if (!isHost || recordingStatus !== "recording" || missingConsentCount === 0) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      stopProvider();
      void persistRecordingStop("failed", "Recording stopped because an active participant had not consented.");
    });
    return () => { cancelled = true; };
  }, [isHost, missingConsentCount, persistRecordingStop, recordingStatus, stopProvider]);

  useEffect(() => {
    if (!flags.recording || !isHost || recordingStatus !== "recording" || missingConsentCount > 0 || !recordingParticipantKey) return;
    let disposed = false;
    const revision = recordingRevision.current;
    // Bind roster changes to the existing recording without restarting the provider.
    queueMicrotask(async () => {
      if (disposed) return;
      try {
        const response = await startLiveTourRecording(tour.id, recordingParticipantKey.split(","));
        if (disposed || !isCurrent() || revision !== recordingRevision.current) return;
        if (response.success) return;
      } catch {
        if (disposed || !isCurrent() || revision !== recordingRevision.current) return;
      }
      stopProvider();
      void persistRecordingStop("failed", "Recording stopped because participant consent could not be confirmed.");
    });
    return () => { disposed = true; };
  }, [flags.recording, isCurrent, isHost, missingConsentCount, persistRecordingStop, recordingParticipantKey, recordingStatus, stopProvider, tour.id]);

  function runHostTourAction(work: () => Promise<
    {success:true;data:{tour:LiveTour}} | {success:true;data:{status:"cancelled"}} | {success:false;error:string}
  >) {
    runAction<{tour:LiveTour}|{status:"cancelled"}>(work, data => {
      updateTourStatus("tour" in data ? data.tour.status : data.status);
      router.refresh();
    });
  }
  function handleEnd() {
    runAction(async () => {
      if (recordingStatusRef.current === "recording" && !stopProvider()) return actionFailure("The recording stop could not be confirmed. Try stopping it again.");
      return endLiveTour(tour.id, peakViewersRef.current);
    }, data => { updateTourStatus(data.status); router.refresh(); });
  }
  const handleConferenceJoined = useCallback((participantId: string) => {
    if (isCurrent()) setConferenceParticipantId(participantId);
  }, [isCurrent]);
  const handleRecordingStatusChanged = useCallback((event: {on:boolean;mode:string;error?:string}) => {
    if (!isCurrent() || !isHost || event.mode !== "file") return;
    if (event.on && recordingStatusRef.current !== "recording") { stopProvider(); return; }
    if (event.error) { void persistRecordingStop("failed", event.error); return; }
    if (!event.on && recordingStatusRef.current === "recording") void persistRecordingStop("stopped");
  }, [isCurrent, isHost, persistRecordingStop, stopProvider]);
  const handleRecordingLinkAvailable = useCallback((event: {link:string;ttl?:number}) => {
    if (!isCurrent() || !isHost || !event.link) return;
    void saveLiveTourRecordingLink(tour.id, {url:event.link,externalId:event.ttl ? "ttl:"+event.ttl : null})
      .then(result => { if (isCurrent() && !result.success) setError(result.error); })
      .catch(() => { if (isCurrent()) setError("The recording link could not be saved. Try again."); });
  }, [isCurrent, isHost, setError, tour.id]);

  if (accessUnavailable) return <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground"><section className="w-full max-w-xl rounded-2xl border border-border bg-panel p-7"><h1 className="text-xl font-semibold text-ink">Access to this tour is unavailable.</h1><p className="mt-2 text-sm text-muted-foreground">Return to the listing or sign in again to check your access.</p><Button render={<Link href={`/listing/${tour.listing_id}`} />} className="mt-4" variant="outline">Back to listing</Button></section></main>;

  const statusFeedback = statusReadError ? <div role="status" className="mb-3 space-y-2 text-sm text-muted-foreground"><p>Tour status could not be refreshed. Try again.</p><Button type="button" size="sm" variant="outline" onClick={() => setReadAttempt(attempt => attempt + 1)}>Retry tour status</Button></div> : null;

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
          {statusFeedback}
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
                  disabled={pending || !flags.scheduledTours}
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
    return <LiveTourTerminal status={status} listingId={tour.listing_id} />;
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

        {statusFeedback}
        {error ? (
          <p
            className="mb-3 rounded-xl border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm text-status-warning-text"
            role="status"
          >
            {error}
          </p>
        ) : null}

        {isHost && providerStopFailed ? <div className="mb-3"><Button type="button" variant="outline" onClick={stopProvider}>Retry recording stop</Button></div> : null}

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
                disabled={pending}
                onClick={() => runAction(() => setLiveTourRecordingConsent(tour.id, !ownConsent), data => {
                  void refreshConsents();
                  toast.success(data.granted ? "Recording consent saved" : "Recording consent withdrawn");
                })}
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
                    onClick={stopProvider}
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
                      const revision = recordingRevision.current;
                      runAction(async () => {
                        if (!videoApiRef.current) return actionFailure("Wait for the video connection before recording.");
                        return startLiveTourRecording(tour.id, activeViewerIds);
                      }, () => {
                        if (recordingRevision.current !== revision && recordingStatusRef.current !== "recording") {
                          setError("The recording state changed. Check the current status before starting again."); return;
                        }
                        try {
                          videoApiRef.current?.executeCommand("startRecording", {mode:"file",shouldShare:true,extraMetadata:{tourId:tour.id}});
                          updateRecording("recording");
                        } catch {
                          setError("Recording could not be started. Check the video connection and try again.");
                          void persistRecordingStop("failed", "Recording provider start failed.");
                        }
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
