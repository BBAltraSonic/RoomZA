"use client";

import { useId } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe2,
  Heart,
  ShieldCheck,
  Sofa,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { useHorizontalScrollAffordance } from "@/lib/hooks/use-horizontal-scroll-affordance";
import { cn } from "@/lib/utils";
import type { QuickFilterKey } from "../lib/types";

/* -------------------------------------------------------------------------- */
/* 1. Category cards — soft 3-up grid of search-intent shortcuts               */
/* -------------------------------------------------------------------------- */

export type QuickFilterOption = {
  id: QuickFilterKey;
  label: string;
  icon: LucideIcon;
  rentOnly?: boolean;
};

export const QUICK_FILTERS: QuickFilterOption[] = [
  { id: "all", label: "All", icon: Globe2 },
  { id: "nsfas-approved", label: "NSFAS", icon: ShieldCheck, rentOnly: true },
  { id: "furnished", label: "Furnished", icon: Sofa },
  { id: "favourites", label: "Saved", icon: Heart },
  { id: "recently-listed", label: "New", icon: Sparkles },
  { id: "recently-viewed", label: "Viewed", icon: Eye },
];

export type QuickFilterNavigation = {
  setScrollElement: (element: HTMLUListElement | null) => void;
  onScroll: (event: React.UIEvent<HTMLUListElement>) => void;
  onWheel: (event: React.WheelEvent<HTMLUListElement>) => void;
  scrollByPage: (direction: "previous" | "next") => void;
  atStart: boolean;
  atEnd: boolean;
  canScroll: boolean;
};

function scrollQuickFilterTrack(element: HTMLElement | null, direction: "previous" | "next") {
  if (!element) return;
  element.scrollBy({
    left: direction === "next" ? element.clientWidth * 0.85 : -element.clientWidth * 0.85,
    behavior: "smooth",
  });
}

/**
 * QuickFilterStrip is a horizontally scrollable set of discovery shortcuts.
 * It keeps one selection active while leaving the editorial sections below intact.
 */
export function QuickFilterStrip({
  activeFilter,
  onFilterChange,
  listingMode,
  navigation,
  showNavigationControls = false,
  className,
}: {
  activeFilter: QuickFilterKey;
  onFilterChange: (filter: QuickFilterKey) => void;
  listingMode: "rent" | "buy";
  navigation?: QuickFilterNavigation;
  showNavigationControls?: boolean;
  className?: string;
}) {
  const filters = QUICK_FILTERS.filter((filter) => listingMode === "rent" || !filter.rentOnly);
  const localNavigation = useHorizontalScrollAffordance<HTMLUListElement>();
  const {
    setScrollElement,
    onScroll,
    onWheel,
    atStart,
    atEnd,
    canScroll,
    scrollByPage,
  } = navigation ?? localNavigation;
  const selectFilter = (filter: QuickFilterKey) => {
    if (filter === activeFilter && filter !== "all") return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
    onFilterChange(filter);
  };

  return (
    <div className={cn("relative flex items-center gap-1", className)}>
      {showNavigationControls ? (
        <button
          type="button"
          aria-label="Scroll quick filters left"
          disabled={!canScroll || atStart}
          onClick={() => scrollByPage("previous")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-panel text-ink shadow-[var(--elevation-2)] transition-[background-color,color,transform,opacity] duration-[220ms] ease-[var(--ease-out-expo)] hover:bg-surface-floating hover:text-forest active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-colors"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
      ) : null}
      <ul
        ref={setScrollElement}
        aria-label="Quick filters"
        data-slot="quick-filter-track"
        data-at-start={atStart}
        data-at-end={atEnd}
        tabIndex={0}
        onScroll={onScroll}
        onWheel={onWheel}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          scrollQuickFilterTrack(event.currentTarget, event.key === "ArrowRight" ? "next" : "previous");
        }}
        className={cn(
          "scroll-contained scroll-snap-row flex touch-pan-x gap-2 overflow-x-auto py-1 scrollbar-hide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          showNavigationControls ? "min-w-0 flex-1 px-1" : "w-full px-4",
        )}
      >
        {filters.map((filter) => {
          const Icon = filter.icon;
          const active = filter.id === activeFilter;
          return (
            <li key={filter.id} className="shrink-0 snap-start">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => selectFilter(filter.id)}
                className={cn(
                  "group inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-[transform,background-color,border-color,color] duration-[220ms] ease-[var(--ease-out-expo)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-colors",
                  active
                    ? "border-forest bg-forest text-primary-foreground"
                    : "border-border/70 bg-panel text-ink hover:border-border hover:bg-surface-floating active:scale-[0.98]",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground")} strokeWidth={1.8} aria-hidden="true" />
                <span>{filter.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {showNavigationControls ? (
        <button
          type="button"
          aria-label="Scroll quick filters right"
          disabled={!canScroll || atEnd}
          onClick={() => scrollByPage("next")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-panel text-ink shadow-[var(--elevation-2)] transition-[background-color,color,transform,opacity] duration-[220ms] ease-[var(--ease-out-expo)] hover:bg-surface-floating hover:text-forest active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-colors"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}


/**
 * Shared discovery feed used by both desktop and mobile. Keep the section
 * order identical across breakpoints so responsive layout changes do not hide
 * or rename the discovery content.
 */
export function DiscoveryExploreSections({
  activeQuickFilter,
  onQuickFilterChange,
  listingMode,
  className,
  showQuickFilters = true,
  quickFilterNavigation,
  showQuickFilterControls = false,
}: {
  activeQuickFilter: QuickFilterKey;
  onQuickFilterChange: (filter: QuickFilterKey) => void;
  listingMode: "rent" | "buy";
  className?: string;
  showQuickFilters?: boolean;
  quickFilterNavigation?: QuickFilterNavigation;
  showQuickFilterControls?: boolean;
}) {
  const lifestyleHeadingId = useId();

  return (
    <div className={cn("flex flex-col gap-6", className)} data-slot="discovery-explore-sections">
      {showQuickFilters ? (
        <section aria-labelledby={lifestyleHeadingId} className="flex flex-col">
          <h2 id={lifestyleHeadingId} className="sr-only">Quick filters</h2>
          <QuickFilterStrip
            activeFilter={activeQuickFilter}
            onFilterChange={onQuickFilterChange}
            listingMode={listingMode}
            navigation={quickFilterNavigation}
            showNavigationControls={showQuickFilterControls}
          />
        </section>
      ) : null}
    </div>
  );
}
