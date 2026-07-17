"use client";

import { Clock3, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

export function findLocationSuggestions(
  query: string,
  candidates: Array<string | null | undefined>,
  limit = 5,
): string[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("en-ZA");
  if (normalizedQuery.length < 2) return [];

  const uniqueCandidates: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase("en-ZA");
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueCandidates.push(trimmed);
  }

  return uniqueCandidates
    .filter((candidate) => candidate.toLocaleLowerCase("en-ZA").includes(normalizedQuery))
    .sort((left, right) => {
      const leftStarts = left.toLocaleLowerCase("en-ZA").startsWith(normalizedQuery);
      const rightStarts = right.toLocaleLowerCase("en-ZA").startsWith(normalizedQuery);
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return left.localeCompare(right, "en-ZA");
    })
    .slice(0, limit);
}

export type LocationSuggestion = {
  id: string;
  label: string;
  secondaryLabel?: string;
  placeId?: string;
  source: "recent" | "places" | "in-view";
};

export type PlaceSuggestion = {
  placeId: string;
  label: string;
  secondaryLabel?: string;
};

function suggestionKey(value: string) {
  return value.trim().toLocaleLowerCase("en-ZA");
}

export function buildLocationSuggestions({
  query,
  recentSearches,
  placeSuggestions,
  inViewCandidates,
  limit = 6,
}: {
  query: string;
  recentSearches: string[];
  placeSuggestions: PlaceSuggestion[];
  inViewCandidates: Array<string | null | undefined>;
  limit?: number;
}): LocationSuggestion[] {
  const normalizedQuery = suggestionKey(query);
  const suggestions: LocationSuggestion[] = [];
  const seen = new Set<string>();

  const addSuggestions = (
    values: Array<string | null | undefined>,
    source: LocationSuggestion["source"],
  ) => {
    for (const value of values) {
      const label = value?.trim();
      if (!label) continue;
      const key = suggestionKey(label);
      if (seen.has(key)) continue;
      if (normalizedQuery && !key.includes(normalizedQuery)) continue;
      seen.add(key);
      suggestions.push({ id: `${source}-${key.replace(/[^a-z0-9]+/g, "-")}`, label, source });
      if (suggestions.length >= limit) return;
    }
  };

  const addPlaceSuggestions = () => {
    for (const place of placeSuggestions) {
      const label = place.label.trim();
      if (!label) continue;
      const key = suggestionKey(`${label} ${place.secondaryLabel ?? ""}`);
      if (seen.has(key)) continue;
      if (normalizedQuery && !key.includes(normalizedQuery)) continue;
      seen.add(key);
      suggestions.push({
        id: `places-${place.placeId}`,
        label,
        secondaryLabel: place.secondaryLabel,
        placeId: place.placeId,
        source: "places",
      });
      if (suggestions.length >= limit) return;
    }
  };

  if (normalizedQuery.length < 2) {
    if (!normalizedQuery) addSuggestions(recentSearches, "recent");
    return suggestions;
  }

  addSuggestions(recentSearches, "recent");
  if (suggestions.length < limit) addPlaceSuggestions();
  if (suggestions.length < limit) {
    addSuggestions(findLocationSuggestions(query, inViewCandidates, limit), "in-view");
  }

  return suggestions.slice(0, limit);
}

export function moveSuggestionIndex(
  currentIndex: number,
  optionCount: number,
  direction: 1 | -1,
) {
  if (optionCount <= 0) return -1;
  if (currentIndex < 0) return direction === 1 ? 0 : optionCount - 1;
  return (currentIndex + direction + optionCount) % optionCount;
}

export function buildPlacePredictionRequest(
  input: string,
  bounds?: google.maps.LatLngBounds,
): google.maps.places.AutocompleteRequest {
  return {
    input: input.trim(),
    includedRegionCodes: ["za"],
    ...(bounds ? { locationBias: bounds } : {}),
  };
}

export function SearchSuggestions({
  id,
  suggestions,
  open,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  className,
}: {
  id: string;
  suggestions: LocationSuggestion[];
  open: boolean;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (suggestion: LocationSuggestion) => void;
  className?: string;
}) {
  if (!open || suggestions.length === 0) return null;

  return (
    <div
      className={cn(
        "absolute inset-x-0 top-[calc(100%+0.5rem)] z-[var(--z-filter-dropdown,35)] overflow-hidden rounded-xl border border-border/60 bg-panel p-1.5 shadow-[var(--elevation-3)]",
        className,
      )}
    >
      <p className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {suggestions.every((suggestion) => suggestion.source === "recent")
          ? "Recent searches"
          : "Search suggestions"}
      </p>
      <ul id={id} role="listbox" aria-label="Location suggestions">
        {suggestions.map((suggestion, index) => (
          <li key={suggestion.id}>
            <button
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => onActiveIndexChange(index)}
              onClick={() => onSelect(suggestion)}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm font-medium text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                index === activeIndex ? "bg-warm-surface" : "hover:bg-warm-surface",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
                {suggestion.source === "recent" ? (
                  <Clock3 className="size-4" aria-hidden="true" />
                ) : (
                  <MapPin className="size-4" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate">{suggestion.label}</span>
                {suggestion.secondaryLabel ? (
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {suggestion.secondaryLabel}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
