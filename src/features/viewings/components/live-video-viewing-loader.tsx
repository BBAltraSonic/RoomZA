"use client";

import dynamic from "next/dynamic";
import { Video } from "lucide-react";
import { useRef } from "react";

import type { LiveVideoViewingProps } from "./live-video-viewing";

function LiveVideoViewingLoading() {
  return (
    <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-lg border border-border bg-ink shadow-[var(--elevation-2)]">
      <div className="flex min-h-14 items-center gap-2 border-b border-white/10 px-4 text-primary-foreground">
        <Video className="size-4 text-accent" />
        <p className="text-sm font-semibold">Loading video room</p>
      </div>
      <div className="flex min-h-[466px] flex-1 items-center justify-center text-sm font-medium text-primary-foreground/80">
        Preparing the video connection...
      </div>
    </div>
  );
}

const DynamicLiveVideoViewing = dynamic<LiveVideoViewingProps>(
  () => import("./live-video-viewing").then((module) => module.LiveVideoViewing),
  {
    ssr: false,
    loading: LiveVideoViewingLoading,
  },
);

export function LiveVideoViewingLoader(props: LiveVideoViewingProps) {
  const loaderRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={loaderRef} className="contents">
      <DynamicLiveVideoViewing {...props} />
    </div>
  );
}
