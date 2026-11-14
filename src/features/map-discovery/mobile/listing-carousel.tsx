"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";

import { useProgressiveWindow } from "@/lib/hooks/use-progressive-window";
import { cn } from "@/lib/utils";
import type { ListingCardModel } from "../lib/types";
import { markerToCardIndex } from "../lib/marker-sync";
import { ListingCard } from "./listing-card";

type ListingCarouselProps = {
  /** Sorted + capped card view models (same array order as the map markers). */
  cards: ListingCardModel[];
  /** Currently selected listing id, mirrored from marker selection. */
  selectedListingId?: string;
  previewedListingId?: string;
  /** Whether listings for the current map view are loading. */
  isLoading: boolean;
  /** Non-null when the most recent fetch failed or timed out. */
  error: string | null;
  /** Optional location-specific explanation in place of the generic fetch error. */
  errorMessage?: string;
  /** Re-request the listings for the current map view. */
  onRetry: () => void;
  /** Open the detail view for the activated card. */
  onSelectCard: (id: string) => void;
  onPreviewCardChange?: (listingId?: string) => void;
  /**
   * Optional rich empty-state node (e.g. the area-alert capture form) rendered
   * when a successful load returns no listings. Falls back to a plain message
   * when not provided.
   */
  emptyState?: React.ReactNode;
  cardPresentation?: "standard" | "desktop-results" | "compact";
};

const SKELETON_KEYS = ["s1", "s2", "s3"];
/** Compact rows are short, so more of them are needed to fill the panel while loading. */
const COMPACT_SKELETON_KEYS = ["c1", "c2", "c3", "c4", "c5"];

type CarouselItemProps = {
  card: ListingCardModel;
  index: number;
  selected: boolean;
  previewed: boolean;
  dimmed: boolean;
  presentation: "standard" | "desktop-results" | "compact";
  registerCard: (id: string, node: HTMLDivElement | null) => void;
  onSelectCard: (id: string) => void;
  onPreviewCardChange?: (listingId?: string) => void;
};

/** Memoised so hovering or selecting a card leaves every other card alone. */
const CarouselItem = memo(function CarouselItem({ card, index, selected, previewed, dimmed, presentation, registerCard, onSelectCard, onPreviewCardChange }: CarouselItemProps) {
  return (
    <div ref={(node) => { registerCard(card.id, node); }} tabIndex={-1} className="outline-none">
      <ListingCard
        card={card}
        variant="grid"
        selected={selected}
        previewed={previewed}
        dimmed={dimmed}
        onPreviewChange={(next) => onPreviewCardChange?.(next ? card.id : undefined)}
        onActivate={() => onSelectCard(card.id)}
        revealIndex={Math.min(index, 10)}
        presentation={presentation}
      />
    </div>
  );
});

/**
 * Listing_Carousel — a vertical, infinite-scroll list of Listing_Cards.
 *
 * Despite the historical name, this renders a full-width vertical list (the
 * grid-variant {@link ListingCard}) that grows as the visitor scrolls. It lives
 * inside the Bottom_Sheet on mobile and the listings panel on desktop, both of
 * which are `overflow-y-auto` scroll containers, so the list scrolls naturally
 * within them.
 *
 * Behavior:
 * - Renders an initial window of cards and reveals more via an
 *   IntersectionObserver sentinel as the visitor nears the end (infinite
 *   scroll), so large capped sets (up to 200) stay cheap to render.
 * - When `selectedListingId` changes, scrolls the matching card into view and
 *   moves focus to it, so keyboard-driven marker activation lands on the card
 *   (Req 3.4, 9.5).
 * - While loading with no cards, shows skeleton placeholders (Req 5.6).
 * - When empty after a successful load, shows an inline empty-state (Req 5.7).
 * - When `error` is non-null, shows an error indication with a Retry control,
 *   retaining any previously displayed cards (Req 5.8, 5.9).
 */
export const ListingCarousel = memo(function ListingCarousel({
  cards,
  selectedListingId,
  previewedListingId,
  isLoading,
  error,
  errorMessage,
  onRetry,
  onSelectCard,
  onPreviewCardChange,
  emptyState,
  cardPresentation = "standard",
}: ListingCarouselProps) {
  // Map of listing id -> card element, used for scroll-to + focus behavior.
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const registerCard = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) cardRefs.current.set(id, node);
    else cardRefs.current.delete(id);
  }, []);
  const focusedSelection = useRef<string | undefined>(undefined);

  const cardSetKey = `${cards.length}:${cards[0]?.id ?? ""}:${cards.at(-1)?.id ?? ""}`;
  const selectedCardIndex = selectedListingId ? markerToCardIndex(cards, selectedListingId) : -1;
  const previewedCardIndex = previewedListingId ? markerToCardIndex(cards, previewedListingId) : -1;
  const { count: renderedCardCount, hasMore: hasMoreToRender, sentinelRef } = useProgressiveWindow({
    total: cards.length,
    resetKey: cardSetKey,
    minCount: Math.max(selectedCardIndex, previewedCardIndex) + 1,
  });

  useEffect(() => {
    // Only a new selection moves the list; a refresh must not steal scroll or focus.
    if (selectedListingId === focusedSelection.current) return;
    if (!selectedListingId) {
      focusedSelection.current = undefined;
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
    focusedSelection.current = selectedListingId;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    // Move focus to the corresponding card after scrolling (Req 9.5).
    target.focus({ preventScroll: true });
  }, [selectedListingId, cards]);

  useEffect(() => {
    if (!previewedListingId || previewedListingId === selectedListingId) return;
    const target = cardRefs.current.get(previewedListingId);
    if (!target) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  }, [previewedListingId, selectedListingId]);

  const hasCards = cards.length > 0;
  const compact = cardPresentation === "compact";
  const showSkeletons = isLoading && !hasCards;
  const showEmptyState = !isLoading && !error && !hasCards;
  const renderedCards = cards.slice(0, renderedCardCount);

  return (
    <div
      role={showSkeletons ? "status" : undefined}
      aria-label={showSkeletons ? "Loading listings" : undefined}
      className={cn("flex flex-col gap-1.5", !showSkeletons && "motion-stage motion-stage-cards")}
    >
      {/* Vertical listing list */}
      <div
        data-slot="listing-carousel-track"
        className={cn("flex flex-col pb-1", compact ? "gap-2.5 px-3" : "gap-4 px-4 lg:pl-6 lg:pr-4")}
      >
        {showSkeletons && compact
          ? COMPACT_SKELETON_KEYS.map((key) => (
              <div
                key={key}
                data-slot="listing-card-skeleton"
                className="flex min-h-28 w-full overflow-hidden rounded-[16px] border border-border/55 bg-card shadow-[var(--elevation-1)]"
                aria-hidden="true"
              >
                <div className="w-28 shrink-0 bg-muted sm:w-32" />
                <div className="min-w-0 flex-1 space-y-2 px-3 py-3">
                  <div className="motion-skeleton h-4 w-24 overflow-hidden rounded bg-muted" />
                  <div className="motion-skeleton h-3.5 w-4/5 overflow-hidden rounded bg-muted" />
                  <div className="motion-skeleton h-3 w-3/5 overflow-hidden rounded bg-muted" />
                  <div className="motion-skeleton h-3 w-2/5 overflow-hidden rounded bg-muted" />
                </div>
              </div>
            ))
          : showSkeletons
          ? SKELETON_KEYS.map((key) => (
              <div
                key={key}
                data-slot="listing-card-skeleton"
                className="flex w-full flex-col overflow-hidden rounded-2xl border border-border/55 bg-card shadow-[var(--property-card-shadow)]"
                aria-hidden="true"
              >
                <div className="aspect-[2/1] w-full overflow-hidden bg-muted" />
                <div className="relative -mt-5 flex justify-center px-5">
                  <div className="flex h-10 w-36 items-center justify-center rounded-full border border-border/55 bg-card px-5 shadow-[var(--property-card-shadow)]">
                    <div className="motion-skeleton h-4 w-20 overflow-hidden rounded bg-muted" />
                  </div>
                </div>
                <div className="space-y-1.5 px-4 pb-2 pt-1.5">
                  <div className="motion-skeleton h-3 w-1/3 overflow-hidden rounded bg-muted" />
                  <div className="motion-skeleton h-4 w-3/4 overflow-hidden rounded bg-muted" />
                  <div className="motion-skeleton h-3 w-2/3 overflow-hidden rounded bg-muted" />
                  <div className="motion-skeleton h-3 w-1/2 overflow-hidden rounded bg-muted" />
                </div>
              </div>
            ))
          : renderedCards.map((card, index) => (
              <CarouselItem
                key={card.id}
                card={card}
                index={index}
                selected={card.id === selectedListingId}
                previewed={card.id === previewedListingId}
                dimmed={Boolean(selectedListingId && card.id !== selectedListingId)}
                presentation={cardPresentation}
                registerCard={registerCard}
                onSelectCard={onSelectCard}
                onPreviewCardChange={onPreviewCardChange}
              />
            ))}

        {/* Infinite-scroll sentinel — observed to load the next chunk. */}
        {hasMoreToRender ? <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" /> : null}
      </div>

      {renderedCards.length < cards.length ? (
        <p className="sr-only" aria-live="polite">
          Showing {renderedCards.length} of {cards.length} homes. More load as you scroll.
        </p>
      ) : null}

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
          className="mx-1 flex items-center justify-between gap-3 rounded-xl border border-status-error-border bg-status-error-surface px-3 py-2 text-sm text-status-error-text"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage ?? "Couldn't load listings."}</span>
          </span>
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              "min-h-11 shrink-0 rounded-full bg-forest px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-forest/90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
});
