"use client";

import { ExternalLink, Video } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LiveVideoViewing({
  joinUrl,
  roomId,
  title,
}: {
  joinUrl: string;
  roomId: string;
  title: string;
}) {
  const url = `${joinUrl}#config.prejoinPageEnabled=false&config.disableDeepLinking=true`;

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
      <iframe
        title={`RoomZA video viewing ${roomId}`}
        src={url}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="h-full min-h-[466px] w-full flex-1 border-0 bg-ink"
      />
    </div>
  );
}
