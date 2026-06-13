"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Home } from "lucide-react";
import { cn } from "@/lib/utils";

type ListingMarkerProps = {
  /** Listing title used to build the accessible name. */
  title: string;
  /** Optional area/location, appended to the accessible name when present. */
  area?: string;
  /** Thumbnail image URL; falls back to a placeholder icon when missing or on error. */
  imageUrl?: string | null;
  /** Whether this marker is the currently selected/active one. */
  selected?: boolean;
  /** Invoked when the marker is activated by tap, Enter, or Space. */
  onActivate?: () => void;
};

/** Milliseconds to wait for the thumbnail to load before showing the placeholder (Req 3.6). */
const THUMBNAIL_FALLBACK_MS = 5000;
/** Rendered thumbnail size in CSS pixels. */
const THUMBNAIL_SIZE = 52;

/**
 * ListingMarker — the visual content placed inside a Google Maps
 * `<AdvancedMarker>` (the marker wrapper itself lives in MapView).
 *
 * Renders a native button containing a rounded thumbnail image of the listing
 * and a small forest pin badge beneath it. When selected, the marker is
 * elevated with a ring + scale treatment (in the spirit of the existing
 * `.roomza-price-pin-selected` style). If the thumbnail fails to load — or
 * does not load within 5 seconds — a placeholder icon is shown instead.
 *
 * Requirements: 3.3, 3.5, 3.6, 10.5
 */
export function ListingMarker({
  title,
  area,
  imageUrl,
  selected = false,
  onActivate,
}: ListingMarkerProps) {
  const hasImage = Boolean(imageUrl);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Reset load/error tracking whenever the image source changes. Using the
  // store-previous-prop pattern (set state during render) instead of an effect
  // keeps the reset synchronous with the source change without tripping
  // react-hooks/set-state-in-effect.
  const [prevImageUrl, setPrevImageUrl] = useState(imageUrl);
  if (imageUrl !== prevImageUrl) {
    setPrevImageUrl(imageUrl);
    setLoaded(false);
    setErrored(false);
  }

  // 5s fallback timer: if the thumbnail hasn't loaded in time, show placeholder.
  useEffect(() => {
    if (!hasImage || loaded || errored) return;
    const timer = setTimeout(() => setTimedOut(true), THUMBNAIL_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [hasImage, loaded, errored, imageUrl]);

  const showPlaceholder = !hasImage || errored || (timedOut && !loaded);

  const ariaLabel = `Open ${title}${area ? ` in ${area}` : ""}`;

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col items-center outline-none",
        "transition-transform duration-200 ease-out",
        selected ? "z-30 scale-105" : "z-10"
      )}
    >
      {/* Rounded-rectangle thumbnail (squircle, matching reference design) */}
      <span
        className={cn(
          "relative block overflow-hidden rounded-[14px] border-2 border-white bg-warm-surface",
          "shadow-[var(--elevation-2)]",
          selected && "ring-2 ring-ink ring-offset-1",
          "group-focus-visible:ring-2 group-focus-visible:ring-forest group-focus-visible:ring-offset-2"
        )}
        style={{ width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
      >
        {showPlaceholder ? (
          <span className="flex h-full w-full items-center justify-center text-ink">
            <Home size={20} strokeWidth={2.5} aria-hidden="true" />
          </span>
        ) : (
          <Image
            src={imageUrl as string}
            alt=""
            fill
            unoptimized
            sizes={`${THUMBNAIL_SIZE}px`}
            className="object-cover"
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        )}
      </span>

      {/* Forest pin badge beneath the thumbnail */}
      <span
        aria-hidden="true"
        className={cn(
          "-mt-1 size-3 rotate-45 rounded-[2px] border-b-2 border-r-2 border-white bg-forest",
          "shadow-[var(--elevation-1)]"
        )}
      />
    </button>
  );
}
