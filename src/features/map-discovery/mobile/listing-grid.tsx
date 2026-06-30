"use client";

// ListingGrid — mobile Grid_View for the Mobile_Map_Discovery feature.
//
// The non-map complement to the Bottom_Sheet carousel: a full-screen,
// vertically scrollable list of listing cards that mirrors the desktop grid
// view (count header + "Most Nearest" sort + responsive card grid). It covers
// the map while the Grid view is active so the visitor can browse every home in
// the current map bounds without the map competing for space.
//
// Reuses the shared ListingCard (grid variant) so the card design stays
// consistent across mobile carousel, mobile grid, and desktop.

import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ListingCardModel } from "../lib/types";
import { ListingCard } from "./listing-card";

type ListingGridProps = {
  /** Sorted + capped card view models (same array/order as the map markers). */
  cards: ListingCardModel[];
  /** Currently selected listing id (kept in sync with the rest of the surface). */
  selectedListingId?: string;
  /** Whether listings for the current map view are loading. */
  isLoading: boolean;
  /** Non-null when the most recent fetch failed or timed out. */
  error: string | null;
  /** Re-request the listings for the current map view. */
  onRetry: () => void;
  /** Open the detail view for the activated card. */
  onSelectCard: (id: string) => void;
  /**
   * Optional rich empty-state node (e.g. the area-alert capture form) rendered
   * when a successful load returns no listings. Falls back to a plain message
   * when not provided.
   */
  emptyState?: React.ReactNode;
};

const SKELETON_KEYS = ["g1", "g2", "g3", "g4"];

export function ListingGrid({
  cards,
  selectedListingId,
  isLoading,
  error,
  onRetry,
  onSelectCard,
  emptyState,
}: ListingGridProps) {
  const hasCards = cards.length > 0;
  const showSkeletons = isLoading && !hasCards;
  const showEmptyState = !isLoading && !error && !hasCards;
  const countLabel = isLoading && !hasCards ? "Loading homes" : `${cards.length} ${cards.length === 1 ? "home" : "homes"} found`;

  return (
    <section
      aria-label="All nearby listings"
      className="pointer-events-auto absolute inset-0 z-[var(--z-list-view)] flex flex-col bg-warm-surface"
    >
      {/* Header — leaves room for the fixed Search & ViewToggle chrome. */}
      <div
        className="flex-none px-5 pb-3"
        style={{ paddingTop: "calc(var(--mobile-safe-top) + 8.25rem)" }}
      >
        <h2 className="text-xl font-bold tracking-tight text-ink">Homes in view</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{countLabel}</p>
      </div>

      {/* Scrollable grid region. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-5 scrollbar-hide"
        style={{ paddingBottom: "calc(var(--mobile-safe-bottom) + 1.5rem)" }}
      >
        {error ? (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-status-error-border bg-status-error-surface px-3 py-2 text-sm text-status-error-text"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>Couldn&apos;t load listings.</span>
            </span>
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                "shrink-0 rounded-full bg-forest px-3 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-forest/90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
            >
              Retry
            </button>
          </div>
        ) : null}

        {showSkeletons ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {SKELETON_KEYS.map((key) => (
              <div
                key={key}
                className="flex w-full flex-col overflow-hidden rounded-lg border border-border/40 bg-card shadow-sm"
                aria-hidden="true"
              >
                <div className="aspect-[16/11] w-full animate-pulse bg-muted" />
                <div className="space-y-3 px-6 pb-5 pt-5">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {showEmptyState ? (
          emptyState ? (
            <div className="py-2">{emptyState}</div>
          ) : (
            <p className="px-1 py-12 text-center text-sm text-muted-foreground">
              No listings in this area. Try panning or zooming the map.
            </p>
          )
        ) : null}

        {hasCards ? (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {cards.map((card, index) => (
                <ListingCard
                  key={card.id}
                  card={card}
                  variant="grid"
                  selected={card.id === selectedListingId}
                  onActivate={() => onSelectCard(card.id)}
                  revealIndex={Math.min(index, 8)}
                />
              ))}
            </div>
            <p className="mt-4 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Closest
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
