"use client";

import { useLatestRead } from "@/lib/hooks/use-latest-read";

import {
  ExternalLink,
  MicOff,
  MonitorUp,
  PictureInPicture2,
  RefreshCw,
  UserMinus,
  Users,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PendingGlyph } from "@/lib/motion/primitives";

import {
  getDocumentPictureInPicture,
  moveElementToPictureInPicture,
} from "./picture-in-picture";

type JitsiParticipant = {
  id: string;
  displayName: string;
  role?: string;
};

type JitsiRoomInfo = {
  rooms?: Array<{
    isMainRoom: boolean;
    participants: JitsiParticipant[];
  }>;
};

type JitsiRecordingEvent = {
  on: boolean;
  mode: string;
  error?: string;
};

type JitsiRecordingLinkEvent = {
  link: string;
  ttl?: number;
};

export type JitsiExternalApi = {
  addEventListener: (event: string, listener: (payload: never) => void) => void;
  dispose: () => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  getIFrame: () => HTMLIFrameElement;
  getRoomsInfo: () => Promise<JitsiRoomInfo>;
};

type JitsiExternalApiConstructor = new (
  domain: string,
  options: {
    roomName: string;
    parentNode: HTMLElement;
    width: string;
    height: string;
    userInfo: { displayName: string };
    configOverwrite: Record<string, unknown>;
  },
) => JitsiExternalApi;

function disposeVideoApi(api: JitsiExternalApi | null) {
  if (!api) return;
  let frame: HTMLIFrameElement | undefined;
  try { frame = api.getIFrame(); } catch { /* An incomplete provider can lack its frame. */ }
  try { api.dispose(); } catch { /* Provider teardown must not interrupt room navigation. */ }
  frame?.remove();
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiExternalApiConstructor;
    documentPictureInPicture?: unknown;
  }
}

let jitsiScriptPromise: Promise<JitsiExternalApiConstructor> | null = null;

function loadJitsiExternalApi() {
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve(window.JitsiMeetExternalAPI);
  }
  if (jitsiScriptPromise) return jitsiScriptPromise;

  jitsiScriptPromise = new Promise<JitsiExternalApiConstructor>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-pinpoint-jitsi-api="true"]',
    );
    const script = existing ?? document.createElement("script");
    script.dataset.pinpointJitsiApi = "true";
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.addEventListener("load", () => {
      if (window.JitsiMeetExternalAPI) resolve(window.JitsiMeetExternalAPI);
      else reject(new Error("jitsi_api_unavailable"));
    }, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("jitsi_api_load_failed")),
      { once: true },
    );
    if (!existing) document.head.appendChild(script);
  }).catch((error: unknown) => {
    // An unsuccessful script never emits another load event. Remove it and
    // release the shared attempt so an ordinary retry can fetch it again.
    document.querySelector('script[data-pinpoint-jitsi-api="true"]')?.remove();
    jitsiScriptPromise = null;
    throw error;
  });

  return jitsiScriptPromise;
}

const hostToolbar = [
  "camera",
  "chat",
  "desktop",
  "fullscreen",
  "hangup",
  "microphone",
  "participants-pane",
  "raisehand",
  "select-background",
  "settings",
  "tileview",
  "videoquality",
];

const viewerToolbar = hostToolbar.filter((button) => button !== "desktop");

export function LiveTourVideo({
  joinUrl,
  roomId,
  title,
  displayName,
  isHost,
  moderationEnabled,
  pictureInPictureEnabled,
  onConferenceJoined,
  onRecordingStatusChanged,
  onRecordingLinkAvailable,
  apiRef,
}: {
  joinUrl: string;
  roomId: string;
  title: string;
  displayName: string;
  isHost: boolean;
  moderationEnabled: boolean;
  pictureInPictureEnabled: boolean;
  onConferenceJoined: (participantId: string) => void;
  onRecordingStatusChanged: (event: JitsiRecordingEvent) => void;
  onRecordingLinkAvailable: (event: JitsiRecordingLinkEvent) => void;
  apiRef: React.MutableRefObject<JitsiExternalApi | null>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const pipRestoreRef = useRef<(() => void) | null>(null);
  const pipControllerRef = useRef<AbortController | null>(null);
  const pipBusyRef = useRef(false);
  const [pipPending, setPipPending] = useState(false);
  const [pipError, setPipError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "failed"
  >("connecting");
  const [retryKey, setRetryKey] = useState(0);
  const [participants, setParticipants] = useState<JitsiParticipant[]>([]);
  const [localRole, setLocalRole] = useState("none");
  const canModerate = isHost && localRole === "moderator";

  const beginRosterRead = useLatestRead(roomId + ":" + retryKey);
  const refreshParticipants = useCallback(async (api: JitsiExternalApi) => {
    if (apiRef.current !== api) return;
    const controller = beginRosterRead();
    try {
      const roomInfo = await api.getRoomsInfo();
      if (controller.signal.aborted || apiRef.current !== api) return;
      const mainRoom = roomInfo.rooms?.find((room) => room.isMainRoom);
      setParticipants(mainRoom?.participants ?? []);
    } catch {
      if (!controller.signal.aborted && apiRef.current === api) setParticipants([]);
    }
  }, [apiRef, beginRosterRead]);

  useEffect(() => {
    let disposed = false;
    let api: JitsiExternalApi | null = null;

    async function connect() {
      setConnectionState("connecting");
      setPipPending(false);
      setPipError(null);
      try {
        const JitsiMeetExternalAPI = await loadJitsiExternalApi();
        if (disposed || !parentRef.current) return;

        api = new JitsiMeetExternalAPI("meet.jit.si", {
          roomName: roomId,
          parentNode: parentRef.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName },
          configOverwrite: {
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            disableInviteFunctions: true,
            startWithAudioMuted: !isHost,
            toolbarButtons: isHost ? hostToolbar : viewerToolbar,
          },
        });
        apiRef.current = api;

        api.addEventListener("videoConferenceJoined", ((payload: {
          id: string;
        }) => {
          if (disposed) return;
          setConnectionState("connected");
          onConferenceJoined(payload.id);
          void refreshParticipants(api!);
        }) as (payload: never) => void);
        api.addEventListener("participantRoleChanged", ((payload: {
          role: string;
        }) => { if (!disposed) setLocalRole(payload.role); }) as (payload: never) => void);
        api.addEventListener(
          "participantJoined",
          (() => void refreshParticipants(api!)) as (payload: never) => void,
        );
        api.addEventListener(
          "participantLeft",
          (() => void refreshParticipants(api!)) as (payload: never) => void,
        );
        api.addEventListener(
          "participantKickedOut",
          (() => void refreshParticipants(api!)) as (payload: never) => void,
        );
        api.addEventListener(
          "recordingStatusChanged",
          ((event: JitsiRecordingEvent) => { if (!disposed) onRecordingStatusChanged(event); }) as (payload: never) => void,
        );
        api.addEventListener(
          "recordingLinkAvailable",
          ((event: JitsiRecordingLinkEvent) => { if (!disposed) onRecordingLinkAvailable(event); }) as (payload: never) => void,
        );
      } catch {
        if (apiRef.current === api) apiRef.current = null;
        disposeVideoApi(api);
        api = null;
        if (!disposed) setConnectionState("failed");
      }
    }

    void connect();
    return () => {
      disposed = true;
      pipControllerRef.current?.abort();
      pipControllerRef.current = null;
      pipBusyRef.current = false;
      pipRestoreRef.current?.();
      pipRestoreRef.current = null;
      if (apiRef.current === api) apiRef.current = null;
      disposeVideoApi(api);
    };
  }, [
    apiRef,
    displayName,
    isHost,
    onConferenceJoined,
    onRecordingLinkAvailable,
    onRecordingStatusChanged,
    refreshParticipants,
    retryKey,
    roomId,
  ]);

  async function enterPictureInPicture() {
    const api = apiRef.current;
    const documentPip = getDocumentPictureInPicture(
      window.documentPictureInPicture,
    );
    if (!api || !documentPip || connectionState !== "connected" || pipBusyRef.current) return;
    const controller = new AbortController();
    pipControllerRef.current = controller;
    pipBusyRef.current = true;
    setPipPending(true);
    setPipError(null);
    try {
      pipRestoreRef.current?.();
      pipRestoreRef.current = null;
      const result = await moveElementToPictureInPicture(api.getIFrame(), documentPip, controller.signal);
      if (controller.signal.aborted || apiRef.current !== api) { result.restore(); return; }
      pipRestoreRef.current = result.restore;
    } catch {
      if (!controller.signal.aborted && apiRef.current === api) setPipError("Could not keep the video visible. Try again.");
    } finally {
      if (pipControllerRef.current === controller) {
        pipBusyRef.current = false;
        setPipPending(false);
      }
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-media-surface shadow-[var(--elevation-2)]">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-media-foreground/10 bg-media-surface px-4 text-media-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <Video className="size-4 shrink-0 text-media-muted" aria-hidden="true" />
          <p className="truncate text-sm font-semibold">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          {pictureInPictureEnabled
          && getDocumentPictureInPicture(
            typeof window === "undefined"
              ? null
              : window.documentPictureInPicture,
          ) ? (
            <Button
              type="button"
              variant="outline"
              disabled={connectionState !== "connected" || pipPending}
              aria-busy={pipPending}
              className="h-11 border-media-foreground/20 bg-media-foreground/10 text-media-foreground hover:bg-media-foreground/15 hover:text-media-foreground sm:h-10"
              onClick={() => void enterPictureInPicture()}
            >
              <PictureInPicture2 className="size-4" aria-hidden="true" />
              Keep visible
            </Button>
          ) : null}
          {isHost ? (
            <Button
              render={<a href={joinUrl} target="_blank" rel="noreferrer" />}
              variant="outline"
              className="h-11 border-media-foreground/20 bg-media-foreground/10 text-media-foreground hover:bg-media-foreground/15 hover:text-media-foreground sm:h-10"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              Open
            </Button>
          ) : null}
        </div>
      </div>

      {pipError ? <p role="alert" className="border-b border-media-foreground/10 px-4 py-3 text-sm text-media-foreground">{pipError}</p> : null}

      <div className="relative h-[min(68dvh,760px)] min-h-[460px] bg-media-surface">
        {connectionState !== "connected" ? (
          <div
            className="absolute inset-x-4 top-4 z-10 rounded-xl border border-media-foreground/15 bg-media-surface/95 p-3 text-sm text-media-foreground shadow-[var(--elevation-2)]"
            role={connectionState === "failed" ? "alert" : "status"}
          >
            {connectionState === "failed" ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p>Video connection failed. Check permissions and try again.</p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-media-foreground/20 bg-media-foreground/10 text-media-foreground hover:bg-media-foreground/15 hover:text-media-foreground sm:h-10"
                  onClick={() => setRetryKey((value) => value + 1)}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Retry
                </Button>
              </div>
            ) : (
              <p className="inline-flex items-center gap-2">
                <PendingGlyph label="Connecting to video room" />
                Connecting to video room...
              </p>
            )}
          </div>
        ) : null}
        <div ref={parentRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
      </div>

      {isHost && moderationEnabled ? (
        <div className="border-t border-media-foreground/10 bg-media-surface px-4 py-4 text-media-foreground">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Host controls</h2>
              <p className="mt-1 text-xs text-media-muted">
                {canModerate
                  ? `${participants.length} participant${participants.length === 1 ? "" : "s"} in the room`
                  : "Moderator controls unlock when the provider confirms host access."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 border-media-foreground/20 bg-media-foreground/10 text-media-foreground hover:bg-media-foreground/15 hover:text-media-foreground sm:h-10"
                disabled={!canModerate}
                onClick={() => apiRef.current?.executeCommand("muteEveryone", "audio")}
              >
                <MicOff className="size-4" aria-hidden="true" />
                Mute all
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 border-media-foreground/20 bg-media-foreground/10 text-media-foreground hover:bg-media-foreground/15 hover:text-media-foreground sm:h-10"
                disabled={!canModerate}
                onClick={() => apiRef.current?.executeCommand("toggleShareScreen")}
              >
                <MonitorUp className="size-4" aria-hidden="true" />
                Share screen
              </Button>
            </div>
          </div>

          {participants.length > 1 ? (
            <ul
              className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
              aria-label="Live tour participants"
            >
              {participants.map((participant) => (
                <li
                  key={participant.id}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-media-foreground/10 px-3 py-2"
                >
                  <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold">
                    <Users className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {participant.displayName || "Viewer"}
                    </span>
                  </span>
                  {participant.role !== "moderator" ? (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        className="size-11 text-media-foreground hover:bg-media-foreground/10 hover:text-media-foreground sm:size-10"
                        aria-label={`Mute ${participant.displayName || "viewer"}`}
                        disabled={!canModerate}
                        onClick={() =>
                          apiRef.current?.executeCommand(
                            "muteRemoteParticipant",
                            participant.id,
                            "audio",
                          )
                        }
                      >
                        <MicOff className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        className="size-11 text-media-error hover:bg-media-foreground/10 hover:text-media-foreground sm:size-10"
                        aria-label={`Remove ${participant.displayName || "viewer"}`}
                        disabled={!canModerate}
                        onClick={() =>
                          apiRef.current?.executeCommand(
                            "kickParticipant",
                            participant.id,
                          )
                        }
                      >
                        <UserMinus className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
