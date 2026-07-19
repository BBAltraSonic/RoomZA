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
  const [street, ...localityParts] = area
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean) ?? [];
  const addressSecondLine = localityParts.join(", ");

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        "discovery-marker-enter group relative flex flex-col items-center outline-none",
        "transition-transform duration-[var(--motion-normal)] ease-[var(--ease-out-expo)]",
        selected ? "z-30 scale-110" : "z-10 hover:scale-105"
      )}
    >
      {/* Price, street, and locality stay together as one compact map label. */}
      <span
        className={cn(
          "flex max-w-60 flex-col items-center justify-center rounded-xl border-0 px-3.5 py-2 text-center transition-all",
          selected
            ? "scale-105 bg-forest text-primary-foreground shadow-[0_4px_12px_oklch(0.34_0.062_164/32%)]"
            : "bg-panel text-forest shadow-[var(--neu-raised-sm)] hover:shadow-[var(--neu-raised)]"
        )}
      >
        <span className="text-xs font-extrabold leading-none">{price}</span>
        {street ? (
          <span
            className={cn(
              "mt-1 max-w-full truncate text-[10px] font-semibold leading-tight",
              selected ? "text-primary-foreground" : "text-ink",
            )}
          >
            {street}
          </span>
        ) : null}
        {addressSecondLine ? (
          <span
            className={cn(
              "max-w-full truncate text-[10px] font-medium leading-tight",
              selected ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {addressSecondLine}
          </span>
        ) : null}
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
