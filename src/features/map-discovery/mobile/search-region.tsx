"use client";

import { Filter, Navigation, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchRegionProps = {
  /** Controlled search value, reused from DiscoveryPage state. */
  searchQuery: string;
  /** Invoked on every input change with the next value. */
  onSearchChange: (value: string) => void;
  /** Invoked when the search form is submitted. */
  onSearchSubmit: () => void;
  /** Optional clear handler; when provided, a clear button is shown while text exists. */
  onClearSearch?: () => void;
  /** Opens the listing filter controls. */
  onToggleFilters: () => void;
  /** Requests the visitor's current location and recenters the map. */
  onLocate: () => void;
  /** Optional ref forwarded to the underlying search input (e.g. for focus). */
  searchInputRef?: React.Ref<HTMLInputElement>;
  /** Reflects whether filters are currently active/open, for visual emphasis. */
  filtersActive?: boolean;
};

const SEARCH_PLACEHOLDER = "Search by listing name or location";

/**
 * SearchRegion — self-contained search region rendered immediately below the
 * App_Bar. The caller positions it; no interactive control is expected between
 * this region and the App_Bar.
 *
 * Hosts the Search_Bar (controlled `<input type="search">`), the Filter_Button,
 * and the Locate_Button. The icon buttons sit to the right of the input within
 * the same region. Mirrors the existing mobile search pill styling.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.7, 2.8, 8.3
 */
export function SearchRegion({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onClearSearch,
  onToggleFilters,
  onLocate,
  searchInputRef,
  filtersActive = false,
}: SearchRegionProps) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearchSubmit();
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-3 py-2"
    >
      {/* Search_Bar — controlled input with a visible focus-within ring */}
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border/80 bg-panel/95 px-4 py-3.5 shadow-sm backdrop-blur-xl transition-colors",
          "focus-within:border-forest focus-within:ring-1 focus-within:ring-forest"
        )}
      >
        <Search className="size-5 shrink-0 text-ink" aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="search"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-muted-foreground"
          placeholder={SEARCH_PLACEHOLDER}
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          maxLength={200}
          aria-label={SEARCH_PLACEHOLDER}
        />
        {onClearSearch && searchQuery ? (
          <button
            type="button"
            onClick={onClearSearch}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all duration-200 hover:text-ink active:scale-95"
            aria-label="Clear search"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Filter_Button — circular ≥44×44 icon button */}
      <button
        type="button"
        onClick={onToggleFilters}
        aria-label="Filter listings"
        className={cn(
          "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest",
          filtersActive
            ? "scale-105 bg-ink text-panel shadow-sm"
            : "bg-panel/95 text-ink shadow-sm backdrop-blur-xl hover:bg-warm-surface"
        )}
      >
        <Filter className="size-5" aria-hidden="true" />
      </button>

      {/* Locate_Button — circular ≥44×44 icon button */}
      <button
        type="button"
        onClick={onLocate}
        aria-label="Use my location"
        className={cn(
          "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-95",
          "bg-panel/95 text-ink shadow-sm backdrop-blur-xl hover:bg-warm-surface",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        )}
      >
        <Navigation className="size-5" aria-hidden="true" />
      </button>
    </form>
  );
}
