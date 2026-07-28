"use client";

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe2,
  Heart,
  ShieldCheck,
  SlidersHorizontal,
  Sofa,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { useHorizontalScrollAffordance } from "@/lib/hooks/use-horizontal-scroll-affordance";
import { cn } from "@/lib/utils";

import { FilterBar, type FilterState } from "./filter-bar";
import type { QuickFilterKey } from "./lib/types";

const DESKTOP_QUICK_FILTERS: Array<{
  id: QuickFilterKey;
  label: string;
  icon: LucideIcon;
  rentOnly?: boolean;
}> = [
  { id: "all", label: "All homes", icon: Globe2 },
  { id: "nsfas-approved", label: "NSFAS", icon: ShieldCheck, rentOnly: true },
  { id: "furnished", label: "Furnished", icon: Sofa },
  { id: "favourites", label: "Saved", icon: Heart },
  { id: "recently-listed", label: "New", icon: Sparkles },
  { id: "recently-viewed", label: "Viewed", icon: Eye },
];

type DesktopFilterRowProps = {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  activeQuickFilter: QuickFilterKey;
  onQuickFilterChange: (filter: QuickFilterKey) => void;
  listingMode: "rent" | "buy";
  resultCount: number;
  isLoading: boolean;
  activeFilterCount: number;
  moreFiltersOpen: boolean;
  onToggleMoreFilters: () => void;
};

export function DesktopFilterRow({
  filters,
  onFilterChange,
  activeQuickFilter,
  onQuickFilterChange,
  listingMode,
  resultCount,
  isLoading,
  activeFilterCount,
  moreFiltersOpen,
  onToggleMoreFilters,
}: DesktopFilterRowProps) {
  const {
    setScrollElement,
    onScroll,
    onWheel,
    scrollByPage,
    atStart,
    atEnd,
    canScroll,
  } = useHorizontalScrollAffordance<HTMLUListElement>();
  const quickFilters = DESKTOP_QUICK_FILTERS.filter(
    (filter) => listingMode === "rent" || !filter.rentOnly,
  );

  return (
    <div
      data-slot="desktop-filter-row"
      className="relative hidden min-h-14 items-center gap-2.5 border-b border-border/60 bg-surface-floating px-6 py-2 shadow-[var(--shadow-control)] lg:flex"
    >
      <FilterBar
        filters={filters}
        onFilterChange={onFilterChange}
        resultCount={resultCount}
        isLoading={isLoading}
        dropdownPlacement="bottom"
        condensed
        showSearchButton={false}
        className="shrink-0"
      />

      <span className="h-7 w-px shrink-0 bg-border/80" aria-hidden="true" />

      <div className="flex min-w-0 flex-1 items-center gap-1">
        <button
          type="button"
          title="Scroll quick filters left"
          aria-label="Scroll quick filters left"
          disabled={!canScroll || atStart}
          onClick={() => scrollByPage("previous")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>

        <ul
          ref={setScrollElement}
          aria-label="Quick filters"
          tabIndex={0}
          onScroll={onScroll}
          onWheel={onWheel}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            scrollByPage(event.key === "ArrowRight" ? "next" : "previous");
          }}
          className="scroll-contained flex min-w-0 flex-1 touch-pan-x items-center gap-2 overflow-x-auto px-1 py-1 scrollbar-hide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {quickFilters.map((filter) => {
            const Icon = filter.icon;
            const active = filter.id === activeQuickFilter;

            return (
              <li key={filter.id} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onQuickFilterChange(filter.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold shadow-[var(--shadow-hairline)] transition-[background-color,border-color,color,transform] duration-[220ms] ease-[var(--ease-out-expo)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] motion-reduce:transition-colors",
                    active
                      ? "border-forest bg-forest text-primary-foreground"
                      : "border-border/80 bg-panel text-ink hover:border-forest/35 hover:bg-muted",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-primary-foreground" : "text-forest",
                    )}
                    strokeWidth={1.9}
                    aria-hidden="true"
                  />
                  {filter.label}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          title="Scroll quick filters right"
          aria-label="Scroll quick filters right"
          disabled={!canScroll || atEnd}
          onClick={() => scrollByPage("next")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        aria-expanded={moreFiltersOpen}
        aria-controls="desktop-more-filters"
        onClick={onToggleMoreFilters}
        className={cn(
          "relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-[var(--shadow-hairline)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          moreFiltersOpen || activeFilterCount > 0
            ? "border-forest bg-accent text-forest"
            : "border-border/80 bg-panel text-ink hover:border-forest/35 hover:bg-muted",
        )}
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        More filters
        {activeFilterCount > 0 ? (
          <span
            aria-hidden="true"
            className="flex size-5 items-center justify-center rounded-full bg-forest text-[10px] font-bold text-primary-foreground"
          >
            {activeFilterCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
