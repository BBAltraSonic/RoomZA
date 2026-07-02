
"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  LIVE_VIDEO_CONNECT_TIMEOUT_MS,
  nextLiveVideoConnectionState,
  type LiveVideoConnectionState,
} from "../live-video-connection";

export type LiveVideoViewingProps = {
  joinUrl: string;
  roomId: string;
  title: string;
};

export function LiveVideoViewing({
  joinUrl,
  roomId,
  title,
}: LiveVideoViewingProps) {
  const url = `${joinUrl}#config.prejoinPageEnabled=false&config.disableDeepLinking=true`;
  const [connectionState, setConnectionState] = useState<LiveVideoConnectionState>("connecting");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setConnectionState((current) => current === "connected" ? current : nextLiveVideoConnectionState("timeout"));
    }, LIVE_VIDEO_CONNECT_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [retryKey, url]);

  const retryConnection = () => {
    setConnectionState(nextLiveVideoConnectionState("retry"));
    setRetryKey((value) => value + 1);
  };

  return (
    <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-lg border border-border bg-ink shadow-[var(--elevation-2)]">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-white/10 bg-ink px-4 text-primary-foreground">
        <div className="flex min-w-0 items-center gap-2">
          <Video className="size-4 shrink-0 text-accent" />
          <p className="truncate text-sm font-semibold">{title}</p>
        </div>
        <Button
          render={<a href={joinUrl} target="_blank" rel="noreferrer" />}
          variant="outline"
          className="h-9 shrink-0 border-white/20 bg-white/10 text-primary-foreground hover:bg-white/15"
        >
          <ExternalLink className="size-4" />
          Open
        </Button>
      </div>
      <div className="relative h-full min-h-[466px] flex-1 bg-ink">
        {connectionState !== "connected" ? (
          <div
            className="absolute inset-x-4 top-4 z-10 rounded-md border border-white/15 bg-ink/90 p-3 text-sm text-primary-foreground shadow-[var(--elevation-2)]"
            role={connectionState === "failed" ? "alert" : "status"}
          >
            {connectionState === "failed" ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>Video connection failed. Check permissions and try again.</p>
                <Button
                  type="button"
                  onClick={retryConnection}
                  variant="outline"
                  className="h-9 border-white/20 bg-white/10 text-primary-foreground hover:bg-white/15"
                >
                  <RefreshCw className="size-4" />
                  Retry
                </Button>
              </div>
            ) : (
              <p className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Connecting to video room...
              </p>
            )}
          </div>
        ) : null}
        <iframe
          key={retryKey}
          title={`RoomZA video viewing ${roomId}`}
          src={url}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          onLoad={() => setConnectionState(nextLiveVideoConnectionState("load"))}
          className="h-full min-h-[466px] w-full border-0 bg-ink"
        />
      </div>
    </div>
  );
}
