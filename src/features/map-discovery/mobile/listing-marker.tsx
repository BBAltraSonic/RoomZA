"use client";

import { Video, Zap } from "lucide-react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { pinPulseDelay } from "../lib/pin-content";

type ListingMarkerProps = {
  /** Listing title used to build the accessible name. */
  title: string;
  /** Optional area/location, appended to the accessible name when present. */
  area?: string;
  /** Optional thumbnail image URL (no longer rendered but kept for prop compatibility). */
  imageUrl?: string | null;
  /** Whether this marker is the currently selected/active one. */
  selected?: boolean;
  /** Whether another discovery surface is temporarily previewing this listing. */
  previewed?: boolean;
  /** Subdues unrelated markers while a listing is selected. */
  dimmed?: boolean;
  /** Low zoom uses a density dot; closer zooms expose the price, then its details. */
  displayMode?: "dot" | "price" | "details";
  /** Invoked when the marker is activated by tap, Enter, or Space. */
  onActivate?: () => void;
  onPreviewChange?: (previewed: boolean) => void;
  /** The monthly rent price to display on the pin. */
  price: string;
  liveState?: "default" | "available" | "live-tour" | "instant-viewing";
  /** Granted by the map, which limits how many pins may animate at once. */
  animated?: boolean;
  /** Stable id used to stagger this pin's pulse; falls back to the title. */
  pulseKey?: string;
  beds?: number;
  /** Distance from the visitor. Never set from the map centre: a pin must not imply that. */
  distance?: string;
  belowNearbyPercent?: number;
  viewingLabel?: string;
  isNew?: boolean;
};

/**
 * ListingMarker — displays the monthly rent price on a map marker pin.
 *
 * Renders a native button styled as a rounded price pill. Tone says what can
 * happen now, and motion is reserved for homes the map has granted it to.
 */
export function ListingMarker({
  title,
  area,
  selected = false,
  previewed = false,
  dimmed = false,
  displayMode = "price",
  onActivate,
  onPreviewChange,
  price,
  liveState = "default",
  animated = false,
  pulseKey,
  beds,
  distance,
  belowNearbyPercent,
  viewingLabel,
  isNew = false,
}: ListingMarkerProps) {
  const statusLabel = {
    default: "",
    available: ", landlord available now",
    "live-tour": ", live video tour happening now",
    "instant-viewing": ", instant viewing in progress",
  }[liveState];
  const bedrooms = beds === undefined ? null : beds === 0 ? "Studio" : `${beds} bed`;
  const facts = [
    bedrooms,
    distance ? `${distance} from you` : null,
    belowNearbyPercent ? `${belowNearbyPercent}% below nearby` : null,
    viewingLabel ?? null,
    isNew ? "new listing" : null,
  ].filter(Boolean);
  const ariaLabel = `${title} - ${price}${area ? ` in ${area}` : ""}${statusLabel}${facts.map(fact => `, ${fact}`).join("")}`;
  // Homes someone can visit right now stay readable while their neighbours are dots.
  const actionable = liveState === "live-tour" || liveState === "instant-viewing";
  const mode = displayMode === "dot" && actionable ? "price" : displayMode;
  const details = mode === "details";
  const detailLine = details ? [bedrooms, distance].filter(Boolean).join(" · ") : "";
  const tag = belowNearbyPercent
    ? (details ? `${belowNearbyPercent}% below nearby` : `↓${belowNearbyPercent}%`)
    : details && viewingLabel ? viewingLabel : isNew ? "New" : undefined;
  const pulse = animated ? <span aria-hidden="true" className="map-pin-pulse" style={{ "--pin-pulse-delay": pinPulseDelay(pulseKey ?? title) } as CSSProperties} /> : null;
  return (
    <button
      type="button"
      onClick={onActivate}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") onPreviewChange?.(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") onPreviewChange?.(false);
      }}
      onFocus={() => onPreviewChange?.(true)}
      onBlur={() => onPreviewChange?.(false)}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        "discovery-marker-enter group relative flex min-h-11 min-w-11 flex-col items-center justify-center outline-none",
        "transition-[transform,opacity] duration-[var(--motion-normal)] ease-[var(--ease-out-expo)]",
        selected ? "z-30 scale-110" : previewed ? "marker-preview-pulse z-20 scale-110" : "z-10 hover:scale-105",
        dimmed && !previewed && "opacity-45",
      )}
    >
      {mode === "dot" ? (
        <span
          aria-hidden="true"
          data-pin-status={liveState}
          className={cn(
            "relative size-3.5 rounded-full border-2 border-panel bg-selection shadow-[var(--elevation-1)] transition-colors",
            selected && "ring-4 ring-selection/20",
            liveState === "available" && "bg-[var(--pin-available)]",
            animated && "[--pin-pulse-color:var(--pin-available)]",
          )}
        >
          {pulse}
        </span>
      ) : (
        <>
          <span
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 rounded-full border px-3 py-2 text-center transition-[background-color,color,box-shadow]",
              details && detailLine && "rounded-2xl",
              selected
                ? "border-selection bg-selection text-selection-foreground shadow-[var(--elevation-3)] ring-4 ring-selection/15"
                : liveState === "live-tour"
                  ? "border-[var(--pin-live)] bg-[var(--pin-live)] text-[var(--pin-live-foreground)] shadow-[var(--elevation-2)] [--pin-pulse-color:var(--pin-live)]"
                  : liveState === "instant-viewing"
                    ? "border-[var(--pin-instant-border)] bg-[var(--pin-instant)] text-[var(--pin-instant-foreground)] shadow-[var(--elevation-2)] [--pin-pulse-color:var(--pin-instant-border)]"
                    : "border-border bg-[var(--brand-panel)] text-[var(--brand-charcoal)] shadow-[var(--elevation-2)] [--pin-pulse-color:var(--pin-available)] hover:bg-selection hover:shadow-[var(--elevation-3)]",
            )}
          >
            {pulse}
            <span className="flex items-center gap-1 whitespace-nowrap">
              {liveState === "available" ? (
                <span aria-hidden="true" data-pin-status="available" className={cn("size-2 rounded-full bg-[var(--pin-available)]", animated && "map-pin-breathe")} />
              ) : null}
              {liveState === "live-tour" ? <Video aria-hidden="true" className="size-3.5" /> : null}
              {liveState === "instant-viewing" ? <Zap aria-hidden="true" className="size-3.5" /> : null}
              {liveState === "live-tour" ? <span className="text-xs font-extrabold leading-none">Live</span> : null}
              <span className="text-xs font-extrabold leading-none">{price}</span>
              {tag ? <span className="map-pin-tag">{tag}</span> : null}
            </span>
            {detailLine ? <span className="whitespace-nowrap text-[0.6875rem] font-semibold leading-none opacity-80">{detailLine}</span> : null}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "-mt-1 size-2.5 rotate-45 border-b border-r border-border/70",
              "bg-forest",
            )}
          />
        </>
      )}
    </button>
  );
}
