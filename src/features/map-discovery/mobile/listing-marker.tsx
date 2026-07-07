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
  /** Invoked when the marker is activated by tap, Enter, or Space. */
  onActivate?: () => void;
  /** The monthly rent price to display on the pin. */
  price: string;
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
  onActivate,
  price,
}: ListingMarkerProps) {
  const ariaLabel = `${title} - ${price}${area ? ` in ${area}` : ""}`;

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col items-center outline-none",
        "transition-transform duration-300 ease-[var(--ease-out-quart)]",
        selected ? "z-30 scale-110" : "z-10 hover:scale-105"
      )}
    >
      {/* Price Pill — warm neumorphic soft-UI pill. Unselected: cream surface
          with the raised warm dual shadow and forest price text. Selected:
          solid brand-green pill with a forest-tinted drop shadow so it pops. */}
      <span
        className={cn(
          "flex items-center justify-center rounded-full border-0 px-3.5 py-1.5 text-xs font-extrabold transition-all",
          selected
            ? "scale-105 bg-forest text-primary-foreground shadow-[0_4px_12px_oklch(0.34_0.062_164/32%)]"
            : "bg-panel text-forest shadow-[var(--neu-raised-sm)] hover:shadow-[var(--neu-raised)]"
        )}
      >
        {price}
      </span>

      {/* Downward-pointing pin tail */}
      <span
        aria-hidden="true"
        className={cn(
          "-mt-1 size-2.5 rotate-45 transition-colors",
          selected ? "bg-forest" : "bg-background"
        )}
      />
    </button>
  );
}
