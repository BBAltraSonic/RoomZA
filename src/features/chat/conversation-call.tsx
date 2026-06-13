"use client";

import { useState, useTransition } from "react";
import { ExternalLink, PhoneOff, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildEmbedUrl } from "@/features/chat/room";
import { endCall, type CallSession } from "@/features/chat/call-actions";

/**
 * Embedded Jitsi call surface for an active conversation call (Requirements
 * 3.1, 3.2, 3.5, 4.1).
 *
 * Mirrors the scheduled-viewing `LiveVideoViewing` iframe pattern: the iframe
 * targets `buildEmbedUrl(session.join_url)`, requests only the audited
 * `camera; microphone; fullscreen; display-capture; autoplay` permissions, and
 * always offers an "Open" external-link fallback so a participant can reach the
 * same room in a separate browser context if the embed fails to load (Req 3.5).
 *
 * The End-call control is wired to `endCall(session.id)` which transitions the
 * non-terminal session to `ended` (Req 4.1). On success the optional `onEnded`
 * callback lets the parent provider drop the call surface.
 */
export function ConversationCall({
  session,
  onEnded,
}: {
  session: CallSession;
  /** Invoked after the call is successfully ended so the parent can update state. */
  onEnded?: (sessionId: string) => void;
}) {
  const embedUrl = buildEmbedUrl(session.join_url);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [isEnding, startEnding] = useTransition();

  const handleEndCall = () => {
    setEndError(null);
    startEnding(async () => {
      const result = await endCall(session.id);
      if (result.success) {
        onEnded?.(session.id);
      } else {
        setEndError(result.error);
      }
    });
  };

  return (
    <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-lg border border-border bg-ink shadow-[var(--elevation-2)]">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-white/10 bg-ink px-4 text-primary-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <Video className="size-4 shrink-0 text-accent" />
          <p className="truncate text-sm font-semibold">Video call</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            render={<a href={session.join_url} target="_blank" rel="noreferrer" />}
            variant="outline"
            className="h-9 shrink-0 border-white/20 bg-white/10 text-primary-foreground hover:bg-white/15"
          >
            <ExternalLink className="size-4" />
            Open
          </Button>
          <Button
            type="button"
            onClick={handleEndCall}
            disabled={isEnding}
            variant="destructive"
            className="h-9 shrink-0"
          >
            <PhoneOff className="size-4" />
            {isEnding ? "Ending…" : "End call"}
          </Button>
        </div>
      </div>

      {iframeFailed ? (
        <div className="flex h-full min-h-[466px] w-full flex-1 flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-primary-foreground">
          <Video className="size-8 text-accent" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">The call couldn&apos;t load here.</p>
            <p className="text-xs text-white/70">
              Open the call in a separate browser tab to continue.
            </p>
          </div>
          <Button
            render={<a href={session.join_url} target="_blank" rel="noreferrer" />}
            variant="outline"
            className="h-9 border-white/20 bg-white/10 text-primary-foreground hover:bg-white/15"
          >
            <ExternalLink className="size-4" />
            Open call
          </Button>
        </div>
      ) : (
        <iframe
          title={`RoomZA video call ${session.room_id}`}
          src={embedUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          onError={() => setIframeFailed(true)}
          className="h-full min-h-[466px] w-full flex-1 border-0 bg-ink"
        />
      )}

      {endError ? (
        <p className="border-t border-white/10 bg-ink px-4 py-2 text-xs text-red-300" role="alert">
          {endError}
        </p>
      ) : null}
    </div>
  );
}
