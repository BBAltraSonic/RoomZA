"use client";

import { Filter, Search, X } from "lucide-react";
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
  /** Optional ref forwarded to the underlying search input (e.g. for focus). */
  searchInputRef?: React.Ref<HTMLInputElement>;
  /** Reflects whether filters are currently active/open, for visual emphasis. */
  filtersActive?: boolean;
};

const SEARCH_PLACEHOLDER = "Search by listing name or location";

/**
 * SearchRegion — self-contained search region rendered at the top of the
 * screen. Hosts the Search_Bar (controlled `<input type="search">`) inside a
 * rounded white pill, with two circular icon buttons — Filter_Button and
 * Locate_Button — aligned to its right (Req 2.1–2.3, 2.7, 8.3).
 */
export function SearchRegion({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onClearSearch,
  onToggleFilters,
  searchInputRef,
  filtersActive = false,
}: SearchRegionProps) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearchSubmit();
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {/* Search_Bar — fully rounded white pill */}
      <form
        role="search"
        onSubmit={handleSubmit}
        className="flex min-w-0 flex-1 items-center"
      >
        <div
          className={cn(
            "pointer-events-auto flex min-w-0 flex-1 items-center gap-2 rounded-full bg-panel pl-3.5 pr-2 py-2 shadow-md transition-colors",
            "focus-within:ring-2 focus-within:ring-ring",
          )}
        >
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted-foreground"
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
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all duration-200 hover:text-ink active:scale-95"
              aria-label="Clear search"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleFilters}
            aria-label="Filter listings"
            aria-pressed={filtersActive}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
              filtersActive
                ? "bg-forest text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-ink",
            )}
          >
            <Filter className="size-3.5" aria-hidden="true" />
          </button>

        </div>
      </form>
    </div>
  );
}
