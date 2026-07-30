"use client";

import { LocateFixed, MapPinned, Minus, Navigation, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type MapControlsProps = {
  className?: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: (coordinates: { lat: number; lng: number }) => void;
  nearbyOpen: boolean;
  onToggleNearby: () => void;
  onDirections?: () => void;
};

export function MapControls({
  className,
  onZoomIn,
  onZoomOut,
  onLocate,
  nearbyOpen,
  onToggleNearby,
  onDirections,
}: MapControlsProps) {
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

  const handleLocateMe = () => {
    if (!("geolocation" in navigator)) {
      settleLocationState("unavailable");
      return;
    }

    setLocationState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocate({ lat: position.coords.latitude, lng: position.coords.longitude });
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
    <div className={cn("motion-stage motion-stage-actions right-4 flex flex-col items-end gap-2 lg:right-5", className)}>
      <button
        type="button"
        onClick={handleLocateMe}
        disabled={locationState === "locating"}
        className={cn(
          "motion-interactive flex size-11 items-center justify-center rounded-full border border-border/70 bg-panel text-ink shadow-[var(--elevation-2)] hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait",
          locationState === "success" && "border-forest bg-forest text-primary-foreground",
          (locationState === "denied" || locationState === "unavailable") && "border-status-warning-border text-status-warning-text",
        )}
        aria-label={locationLabel}
      >
        <LocateFixed className={cn("size-4", locationState === "locating" && "animate-pulse")} />
        <span className="sr-only" aria-live="polite">{locationState === "idle" ? "" : locationLabel}</span>
      </button>

      <div className="overflow-hidden rounded-full border border-border/70 bg-panel shadow-[var(--elevation-2)]">
        <button
          type="button"
          onClick={onZoomIn}
          className="motion-interactive flex size-11 items-center justify-center text-ink hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Zoom in"
        >
          <Plus className="size-4" />
        </button>
        <div className="h-px bg-border" />
        <button
          type="button"
          onClick={onZoomOut}
          className="motion-interactive flex size-11 items-center justify-center text-ink hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Zoom out"
        >
          <Minus className="size-4" />
        </button>
      </div>

      <div className="mt-2 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={onToggleNearby}
          aria-pressed={nearbyOpen}
          className={cn(
            "motion-interactive flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/70 bg-panel px-3.5 text-sm font-semibold text-ink shadow-[var(--elevation-2)] hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            nearbyOpen && "border-forest bg-forest text-primary-foreground hover:bg-forest hover:text-primary-foreground",
          )}
          aria-label={nearbyOpen ? "Close nearby places" : "Explore nearby places"}
        >
          <MapPinned className="size-4" aria-hidden="true" />
          <span className="hidden lg:inline">Nearby</span>
        </button>

        {onDirections ? (
          <button
            type="button"
            onClick={onDirections}
            className="motion-interactive flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/70 bg-panel px-3.5 text-sm font-semibold text-ink shadow-[var(--elevation-2)] hover:bg-warm-surface hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Directions to selected property"
          >
            <Navigation className="size-4" aria-hidden="true" />
            <span className="hidden lg:inline">Directions</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
