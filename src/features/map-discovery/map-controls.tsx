"use client";

import { useMap } from "@vis.gl/react-google-maps";
import { Layers, LocateFixed, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

type MapControlsProps = {
  className?: string;
  onLayersClick?: () => void;
  activeLayerCount?: number;
};

export function MapControls({ className, onLayersClick, activeLayerCount = 0 }: MapControlsProps) {
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
    <div className={cn("right-4 flex flex-col gap-2 lg:right-6", className)}>
      <button
        type="button"
        onClick={handleLocateMe}
        className="flex size-11 items-center justify-center rounded-full border border-border bg-panel text-ink shadow-[var(--elevation-2)] transition-colors hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-10 md:rounded-md"
        aria-label="Locate me"
      >
        <LocateFixed className="size-4" />
      </button>

      <div className="overflow-hidden rounded-full border border-border bg-panel shadow-[var(--elevation-2)] md:rounded-md">
        <button
          type="button"
          onClick={handleZoomIn}
          className="flex size-11 items-center justify-center text-ink transition-colors hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-10"
          aria-label="Zoom in"
        >
          <Plus className="size-4" />
        </button>
        <div className="h-px bg-border" />
        <button
          type="button"
          onClick={handleZoomOut}
          className="flex size-11 items-center justify-center text-ink transition-colors hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-10"
          aria-label="Zoom out"
        >
          <Minus className="size-4" />
        </button>
      </div>

      {onLayersClick && (
        <button
          type="button"
          onClick={onLayersClick}
          className="relative mt-2 flex size-11 items-center justify-center rounded-full border border-border bg-panel text-ink shadow-[var(--elevation-2)] transition-colors hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-10 md:rounded-md"
          aria-label="Toggle layers"
        >
          <Layers className="size-4" />
          {activeLayerCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-forest text-[10px] font-bold text-primary-foreground">
              {activeLayerCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
