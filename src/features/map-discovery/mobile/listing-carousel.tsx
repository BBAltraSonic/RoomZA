"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { cn } from "@/lib/utils";
import { listItemVariants } from "@/lib/motion/presets";
import { MOTION_SPRING } from "@/lib/motion/tokens";
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
};

const SKELETON_KEYS = ["s1", "s2", "s3"];

const INITIAL_CARD_COUNT = 8;
const CARD_RENDER_CHUNK = 8;

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
export function ListingCarousel({
  cards,
  selectedListingId,
  previewedListingId,
  isLoading,
  error,
  onRetry,
  onSelectCard,
  onPreviewCardChange,
  emptyState,
}: ListingCarouselProps) {
  // Map of listing id -> card element, used for scroll-to + focus behavior.
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [renderWindow, setRenderWindow] = useState({ key: "", count: INITIAL_CARD_COUNT });

  const cardSetKey = `${cards.length}:${cards[0]?.id ?? ""}:${cards.at(-1)?.id ?? ""}`;
  const selectedCardIndex = selectedListingId ? markerToCardIndex(cards, selectedListingId) : -1;
  const previewedCardIndex = previewedListingId ? markerToCardIndex(cards, previewedListingId) : -1;
  const renderedCardCount = Math.max(
    renderWindow.key === cardSetKey ? renderWindow.count : INITIAL_CARD_COUNT,
    selectedCardIndex + 1,
    previewedCardIndex + 1,
  );

  const revealMore = useCallback(() => {
    setRenderWindow((current) => ({
      key: cardSetKey,
      count: Math.min(
        cards.length,
        (current.key === cardSetKey ? current.count : INITIAL_CARD_COUNT) + CARD_RENDER_CHUNK,
      ),
    }));
  }, [cardSetKey, cards.length]);

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

  // Infinite scroll: reveal the next chunk whenever the sentinel below the list
  // scrolls into view. IntersectionObserver observes the nearest scrollable
  // ancestor automatically, so this works inside both the bottom sheet and the
  // desktop panel without wiring up scroll handlers.
  const hasMoreToRender = renderedCardCount < cards.length;
  useEffect(() => {
    if (!hasMoreToRender) return;
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          revealMore();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreToRender, revealMore, cardSetKey]);

  const hasCards = cards.length > 0;
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
        className={cn("flex flex-col gap-4 px-4 pb-1 lg:px-5")}
      >
        {showSkeletons
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
          : (
            <AnimatePresence initial={false} mode="popLayout">
              {renderedCards.map((card, index) => (
              <m.div
                key={card.id}
                layout
                variants={listItemVariants}
                initial={false}
                animate="visible"
                exit="exit"
                transition={MOTION_SPRING.soft}
                ref={(node) => {
                  if (node) {
                    cardRefs.current.set(card.id, node);
                  } else {
                    cardRefs.current.delete(card.id);
                  }
                }}
                tabIndex={-1}
                className="outline-none"
              >
                <ListingCard
                  card={card}
                  variant="grid"
                  selected={card.id === selectedListingId}
                  previewed={card.id === previewedListingId}
                  dimmed={Boolean(selectedListingId && card.id !== selectedListingId)}
                  onPreviewChange={(previewed) => onPreviewCardChange?.(previewed ? card.id : undefined)}
                  onActivate={() => onSelectCard(card.id)}
                  revealIndex={Math.min(index, 10)}
                />
              </m.div>
              ))}
            </AnimatePresence>
          )}

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
            <span>Couldn&apos;t load listings.</span>
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
}
