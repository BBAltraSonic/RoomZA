"use client";

import { cn } from "@/lib/utils";

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
  /** Low zoom uses a neutral density dot; closer zooms expose the price. */
  displayMode?: "dot" | "price";
  /** Invoked when the marker is activated by tap, Enter, or Space. */
  onActivate?: () => void;
  onPreviewChange?: (previewed: boolean) => void;
  /** The monthly rent price to display on the pin. */
  price: string;
  liveState?: "default" | "available" | "live-tour" | "instant-viewing";
};

/**
 * ListingMarker — displays the monthly rent price on a map marker pin.
 *
 * Renders a native button styled as a rounded price pill. When selected, the
 * marker is visually highlighted using the brand forest color and a scale treatment.
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
}: ListingMarkerProps) {
  const statusLabel = {
    default: "",
    available: ", landlord available now",
    "live-tour": ", live video tour happening now",
    "instant-viewing": ", instant viewing in progress",
  }[liveState];
  const ariaLabel = `${title} - ${price}${area ? ` in ${area}` : ""}${statusLabel}`;
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
      {displayMode === "dot" ? (
        <span
          aria-hidden="true"
          className={cn(
            "size-3.5 rounded-full border-2 border-panel bg-ink/65 shadow-[var(--elevation-1)] transition-colors",
            selected && "bg-forest",
            liveState === "available" && "ring-2 ring-forest/45",
            liveState === "live-tour" && "ring-2 ring-[var(--status-info-border)]",
            liveState === "instant-viewing" && "ring-2 ring-[var(--status-warning-border)]",
          )}
        />
      ) : (
        <>
          <span
            className={cn(
              "relative flex items-center justify-center rounded-full border border-border/70 px-3 py-2 text-center shadow-[var(--elevation-1)] transition-[background-color,color,box-shadow]",
              liveState === "available" && "ring-2 ring-forest/45",
              liveState === "live-tour" && "ring-2 ring-[var(--status-info-border)]",
              liveState === "instant-viewing" && "ring-2 ring-[var(--status-warning-border)]",
              selected
                ? "bg-forest text-primary-foreground shadow-[var(--elevation-2)]"
                : "bg-panel text-ink hover:shadow-[var(--elevation-2)]",
            )}
          >
            {liveState !== "default" ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-panel",
                  liveState === "available" && "bg-forest",
                  liveState === "live-tour" && "bg-status-info-text",
                  liveState === "instant-viewing" && "bg-status-warning-text",
                )}
              />
            ) : null}
            <span className="text-xs font-extrabold leading-none">{price}</span>
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "-mt-1 size-2.5 rotate-45 border-b border-r border-border/70",
              selected ? "bg-forest" : "bg-panel",
            )}
          />
        </>
      )}
    </button>
  );
}
