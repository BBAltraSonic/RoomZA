"use client";

import { useMap } from "@vis.gl/react-google-maps";
import { LocateFixed, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

type MapControlsProps = {
  className?: string;
};

export function MapControls({ className }: MapControlsProps) {
  const map = useMap("roomza-discovery-map");

  const handleZoomIn = () => {
    if (map) map.setZoom((map.getZoom() ?? 0) + 1);
  };

  const handleZoomOut = () => {
    if (map) map.setZoom((map.getZoom() ?? 0) - 1);
  };

  const handleLocateMe = () => {
    if (!map || !("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition((position) => {
      map.panTo({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      map.setZoom(15);
    });
  };

  return (
    <div className={cn("right-4 flex flex-col gap-2 lg:right-[var(--sidebar-offset-lg)] xl:right-[var(--sidebar-offset-xl)]", className)}>
      <button
        type="button"
        onClick={handleLocateMe}
        className="flex size-10 items-center justify-center rounded-md border border-border bg-panel text-ink shadow-[var(--elevation-2)] transition-colors hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Locate me"
      >
        <LocateFixed className="size-4" />
      </button>

      <div className="overflow-hidden rounded-md border border-border bg-panel shadow-[var(--elevation-2)]">
        <button
          type="button"
          onClick={handleZoomIn}
          className="flex size-10 items-center justify-center text-ink transition-colors hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Zoom in"
        >
          <Plus className="size-4" />
        </button>
        <div className="h-px bg-border" />
        <button
          type="button"
          onClick={handleZoomOut}
          className="flex size-10 items-center justify-center text-ink transition-colors hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Zoom out"
        >
          <Minus className="size-4" />
        </button>
      </div>
    </div>
  );
}
