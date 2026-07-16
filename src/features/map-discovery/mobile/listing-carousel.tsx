"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { cn } from "@/lib/utils";
import { useHorizontalScrollAffordance } from "@/lib/hooks/use-horizontal-scroll-affordance";
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

/** Cap the page-indicator dots for large sets so the row stays legible. */
const MAX_DOTS = 5;
const INITIAL_CARD_COUNT = 8;
const CARD_RENDER_CHUNK = 8;

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [renderWindow, setRenderWindow] = useState({ key: "", count: INITIAL_CARD_COUNT });
  const {
    setScrollElement,
    onScroll: handleAffordanceScroll,
    onWheel: handleAffordanceWheel,
    atStart,
    atEnd,
  } = useHorizontalScrollAffordance<HTMLDivElement>();

  const cardSetKey = `${cards.length}:${cards[0]?.id ?? ""}:${cards.at(-1)?.id ?? ""}`;
  const selectedCardIndex = selectedListingId ? markerToCardIndex(cards, selectedListingId) : -1;
  const renderedCardCount = Math.max(
    renderWindow.key === cardSetKey ? renderWindow.count : INITIAL_CARD_COUNT,
    selectedCardIndex + 1,
  );

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
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", inline: "center", block: "nearest" });
    // Move focus to the corresponding card after scrolling (Req 9.5).
    target.focus({ preventScroll: true });
  }, [selectedListingId, cards]);

  // Track the active page from scroll position. The cells are narrower than the
  // viewport (they peek), so derive the per-card stride from the first cell's
  // offset rather than the container width (mirrors property-card.tsx:103-109).
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - el.clientWidth * 1.5) {
      setRenderWindow((current) => ({
        key: cardSetKey,
        count: Math.min(
          cards.length,
          (current.key === cardSetKey ? current.count : INITIAL_CARD_COUNT) + CARD_RENDER_CHUNK,
        ),
      }));
    }
    const stride = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth;
    if (stride <= 0) return;
    const index = Math.round(el.scrollLeft / stride);
    setActiveIndex((prev) => (prev === index ? prev : index));
    handleAffordanceScroll(event);
  };

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
      {/* Horizontal scroll container */}
      <div
        ref={setScrollElement}
        onScroll={handleScroll}
        onWheel={handleAffordanceWheel}
        data-at-start={atStart}
        data-at-end={atEnd}
        data-slot="listing-carousel-track"
        className={cn(
          "scroll-contained scroll-snap-row flex items-start gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide lg:px-5",
        )}
      >
        {showSkeletons
          ? SKELETON_KEYS.map((key) => (
              <div
                key={key}
                data-slot="listing-card-skeleton"
                className="flex w-[88vw] max-w-[390px] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border border-border/55 bg-card shadow-[var(--property-card-shadow)]"
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
                className="snap-center outline-none"
              >
                <ListingCard
                  card={card}
                  selected={card.id === selectedListingId}
                  onActivate={() => onSelectCard(card.id)}
                  revealIndex={Math.min(index, 10)}
                />
              </m.div>
              ))}
            </AnimatePresence>
          )}
      </div>

      {renderedCards.length < cards.length ? (
        <p className="sr-only" aria-live="polite">
          Showing {renderedCards.length} of {cards.length} homes. More load as you browse.
        </p>
      ) : null}

      {/* Page-indicator dots — mirror the reference's progress dots below the
          featured card. Capped at MAX_DOTS for large sets; the active dot
          tracks the carousel's scroll position. */}
      {hasCards && cards.length > 1 && (
        <div data-slot="listing-carousel-indicators" aria-hidden="true" className="mx-auto flex items-center justify-center gap-1 pt-0.5">
            {Array.from({ length: Math.min(cards.length, MAX_DOTS) }).map((_, dotIndex) => {
              const isActive = dotIndex === Math.min(activeIndex, MAX_DOTS - 1);
              return (
                <span
                  key={dotIndex}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200 ease-[var(--ease-out-quart)]",
                    isActive ? "w-3 bg-forest" : "w-1.5 bg-forest/20",
                  )}
                />
              );
            })}
        </div>
      )}

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
