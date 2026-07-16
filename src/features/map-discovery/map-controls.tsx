"use client";

import { useMap } from "@vis.gl/react-google-maps";
import { Layers, LocateFixed, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type MapControlsProps = {
  className?: string;
  onLayersClick?: () => void;
  activeLayerCount?: number;
};

export function MapControls({ className, onLayersClick, activeLayerCount = 0 }: MapControlsProps) {
  const map = useMap("roomza-discovery-map");
  const [locationState, setLocationState] = useState<"idle" | "locating" | "success" | "denied" | "unavailable">("idle");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, []);

  const settleLocationState = (state: "success" | "denied" | "unavailable") => {
    setLocationState(state);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setLocationState("idle"), 2400);
  };

  const handleZoomIn = () => {
    if (map) map.setZoom((map.getZoom() ?? 0) + 1);
  };

  const handleZoomOut = () => {
    if (map) map.setZoom((map.getZoom() ?? 0) - 1);
  };

  const handleLocateMe = () => {
    if (!map || !("geolocation" in navigator)) {
      settleLocationState("unavailable");
      return;
    }

    setLocationState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.panTo({ lat: position.coords.latitude, lng: position.coords.longitude });
        map.setZoom(15);
        settleLocationState("success");
      },
      (error) => settleLocationState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8000 },
    );
  };

  const locationLabel = locationState === "locating"
    ? "Finding your location"
    : locationState === "success"
      ? "Map centered on your location"
      : locationState === "denied"
        ? "Location access denied"
        : locationState === "unavailable"
          ? "Location unavailable"
          : "Locate me";

  return (
    <div className={cn("motion-stage motion-stage-actions right-4 flex flex-col gap-2 lg:right-6", className)}>
      <button
        type="button"
        onClick={handleLocateMe}
        disabled={locationState === "locating"}
        className={cn(
          "motion-interactive flex size-11 items-center justify-center rounded-full border border-border bg-panel text-ink shadow-[var(--elevation-2)] hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait md:size-10 md:rounded-md",
          locationState === "success" && "border-forest bg-forest text-primary-foreground",
          (locationState === "denied" || locationState === "unavailable") && "border-status-warning-border text-status-warning-text",
        )}
        aria-label={locationLabel}
      >
        <LocateFixed className={cn("size-4", locationState === "locating" && "animate-pulse")} />
        <span className="sr-only" aria-live="polite">{locationState === "idle" ? "" : locationLabel}</span>
      </button>

      <div className="overflow-hidden rounded-full border border-border bg-panel shadow-[var(--elevation-2)] md:rounded-md">
        <button
          type="button"
          onClick={handleZoomIn}
          className="motion-interactive flex size-11 items-center justify-center text-ink hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-10"
          aria-label="Zoom in"
        >
          <Plus className="size-4" />
        </button>
        <div className="h-px bg-border" />
        <button
          type="button"
          onClick={handleZoomOut}
          className="motion-interactive flex size-11 items-center justify-center text-ink hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-10"
          aria-label="Zoom out"
        >
          <Minus className="size-4" />
        </button>
      </div>

      {onLayersClick && (
        <button
          type="button"
          onClick={onLayersClick}
          className="motion-interactive relative mt-2 flex size-11 items-center justify-center rounded-full border border-border bg-panel text-ink shadow-[var(--elevation-2)] hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-10 md:rounded-md"
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
