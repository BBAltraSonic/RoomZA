"use client";

import { DiscoveryLocationAction } from "@/features/discovery/location-action";

type PropertyEmptyStateProps = {
  hasFilters: boolean;
  onClear: () => void;
  location: string;
  selectedPlace?: boolean;
  compact?: boolean;
};

export function PropertyEmptyState({
  hasFilters,
  onClear,
  location,
  selectedPlace = false,
  compact = false,
}: PropertyEmptyStateProps) {
  const title = hasFilters
    ? "No homes match these filters"
    : compact
      ? "No homes here yet"
      : selectedPlace
        ? `No homes in ${location} yet`
        : "No homes in this map area yet";

  return (
    <section className={compact ? "py-1" : "px-5 py-6"} aria-label="No matching homes">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {!compact ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {hasFilters
            ? "Clear your filters or choose another location."
            : `Explore nearby on the map or choose another location. Viewing ${location}.`}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {hasFilters ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-sm font-semibold text-primary-foreground hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear filters
          </button>
        ) : (
          <DiscoveryLocationAction idPrefix="desktop">Choose another location</DiscoveryLocationAction>
        )}
      </div>
    </section>
  );
}
