"use client";

import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ListingCardModel } from "../lib/types";
import { markerToCardIndex } from "../lib/marker-sync";
import { ListingCard } from "./listing-card";
import { SortLabel } from "./sort-label";

type ListingCarouselProps = {
  /** Sorted + capped card view models (same array order as the map markers). */
  cards: ListingCardModel[];
  /** Currently selected listing id, mirrored from marker selection. */
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

const SKELETON_KEYS = ["s1", "s2", "s3"];

/**
 * Listing_Carousel — a horizontally scrollable, snap-scroll row of
 * Listing_Cards inside the Bottom_Sheet (Req 5.1, 5.6–5.9).
 *
 * Behavior:
 * - When `selectedListingId` changes, scrolls the matching card to center
 *   within 300ms via `scrollIntoView({ behavior: 'smooth', inline: 'center',
 *   block: 'nearest' })`, resolving the index with `markerToCardIndex`
 *   (Req 3.4). After scrolling, focus moves to the corresponding card element
 *   so keyboard-driven marker activation lands focus on the card (Req 9.5).
 * - While loading with no cards, shows skeleton placeholders (Req 5.6).
 * - When empty after a successful load, shows an inline empty-state message
 *   (Req 5.7).
 * - When `error` is non-null, shows an error indication with a Retry control,
 *   retaining any previously displayed cards (Req 5.8, 5.9).
 * - Renders the Sort_Label below the carousel (Req 6.1, 6.6).
 */
export function ListingCarousel({
  cards,
  selectedListingId,
  isLoading,
  error,
  onRetry,
  onSelectCard,
  emptyState,
}: ListingCarouselProps) {
  // Map of listing id -> card element, used for scroll-to + focus behavior.
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!selectedListingId) {
      return;
    }

    const index = markerToCardIndex(cards, selectedListingId);
    if (index < 0) {
      return;
    }

    const target = cardRefs.current.get(selectedListingId);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    // Move focus to the corresponding card after scrolling (Req 9.5).
    target.focus({ preventScroll: true });
  }, [selectedListingId, cards]);

  const hasCards = cards.length > 0;
  const showSkeletons = isLoading && !hasCards;
  const showEmptyState = !isLoading && !error && !hasCards;

  return (
    <div className="flex flex-col gap-2">
      {/* Horizontal scroll container */}
      <div
        className={cn(
          "flex items-start gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory scrollbar-hide",
        )}
      >
        {showSkeletons
          ? SKELETON_KEYS.map((key) => (
              <div
                key={key}
                className="h-[300px] w-[280px] shrink-0 animate-pulse snap-center rounded-[20px] bg-muted"
                aria-hidden="true"
              />
            ))
          : cards.map((card, index) => (
              <div
                key={card.id}
                ref={(node) => {
                  if (node) {
                    cardRefs.current.set(card.id, node);
                  } else {
                    cardRefs.current.delete(card.id);
                  }
                }}
                tabIndex={-1}
                className="snap-center outline-none"
              >
                <ListingCard
                  card={card}
                  selected={card.id === selectedListingId}
                  onActivate={() => onSelectCard(card.id)}
                  revealIndex={Math.min(index, 8)}
                />
              </div>
            ))}
      </div>

      {/* Empty state (Req 5.7) */}
      {showEmptyState &&
        (emptyState ? (
          <div className="px-1 py-2">{emptyState}</div>
        ) : (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            No listings in this area. Try panning or zooming the map.
          </p>
        ))}

      {/* Error indication + retry (Req 5.8, 5.9) */}
      {error && (
        <div
          role="alert"
          className="mx-1 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
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
      )}

      {/* Sort label below the carousel (Req 6.1, 6.6) */}
      <SortLabel cardCount={cards.length} />
    </div>
  );
}
