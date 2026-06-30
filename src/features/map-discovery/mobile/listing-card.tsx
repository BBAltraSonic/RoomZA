"use client";

import { PropertyCard, SaveIconButton } from "@/components/premium/property-card";
import { cn } from "@/lib/utils";

import { useFavorites } from "../hooks/use-favorites";
import type { ListingCardModel } from "../lib/types";
import { formatDistance } from "../lib/format";

type ListingCardProps = {
  /** View model for the listing represented by this card. */
  card: ListingCardModel;
  /** Whether this card is the currently selected one (mirrors marker selection). */
  selected?: boolean;
  /** Invoked on tap / Enter / Space to open the listing detail view. */
  onActivate: () => void;
  /**
   * Layout context for the card.
   * - "carousel" (default): fixed-width, snap-aligned cell for the horizontal
   *   Bottom_Sheet carousel.
   * - "grid": full-width, richer card for the vertical Grid_View list.
   */
  variant?: "carousel" | "grid";
  /**
   * Optional position used to stagger the entrance animation. When provided,
   * the card plays a one-time fade+slide reveal delayed by its index. Omit (or
   * pass null) to render with no entrance animation.
   */
  revealIndex?: number | null;
};

/**
 * ListingCard — the shared listing card for the mobile surfaces.
 *
 * Reuses the desktop {@link PropertyCard} so the mobile and desktop surfaces
 * share one card design and brand language. In the "carousel" variant it keeps
 * a fixed width for the horizontal snap-scroll Bottom_Sheet (Req 5.1–5.5); in
 * the "grid" variant it expands full-width to fill a Grid_View cell, matching
 * the desktop grid.
 *
 * The {@link ListingCardModel} carries no agent/address data, so — mirroring the
 * desktop discovery list — we surface the computed distance as the card's
 * location line.
 */
export function ListingCard({ card, selected, onActivate, variant = "carousel", revealIndex = null }: ListingCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(card.id);

  const distanceLabel =
    card.distanceKm === null ? null : `${formatDistance(card.distanceKm)} away`;

  const isGrid = variant === "grid";

  // One-time staggered entrance. Index is capped by the caller so the last
  // card never waits too long; reduced-motion collapses it via the global
  // safeguard in globals.css.
  const reveal = revealIndex != null;
  const revealClass = reveal
    ? isGrid
      ? "discovery-card-reveal"
      : "discovery-card-reveal-x"
    : undefined;

  return (
    <div
      className={cn(isGrid ? "w-full" : "w-72 shrink-0 snap-center", revealClass)}
      style={reveal ? ({ "--stagger-index": revealIndex } as React.CSSProperties) : undefined}
    >
      <PropertyCard
        compact={!isGrid}
        selected={selected}
        onSelect={onActivate}
        showVideoCall={false}
        property={{
          id: card.id,
          title: card.title,
          area: distanceLabel,
          price: card.price,
          bedrooms: card.bedrooms,
          bathrooms: card.bathrooms,
          imageUrls: card.imageUrls,
          imageUrl: card.imageUrls[0],
        }}
        action={
          <SaveIconButton
            saved={favorited}
            onClick={(event) => {
              event.stopPropagation();
              toggleFavorite(card.id);
            }}
          />
        }
      />
    </div>
  );
}
