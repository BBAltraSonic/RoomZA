"use client";

import { PropertyCard, SaveIconButton } from "@/components/premium/property-card";

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
 * desktop discovery list — we supply reference agent details and surface the
 * computed distance as the card's location line.
 */
export function ListingCard({ card, selected, onActivate, variant = "carousel" }: ListingCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(card.id);

  const distanceLabel =
    card.distanceKm === null ? null : `${formatDistance(card.distanceKm)} away`;

  const isGrid = variant === "grid";

  return (
    <div className={isGrid ? "w-full" : "w-[280px] shrink-0 snap-center"}>
      <PropertyCard
        compact={!isGrid}
        selected={selected}
        onSelect={onActivate}
        property={{
          id: card.id,
          title: card.title,
          area: distanceLabel,
          price: card.price,
          bedrooms: card.bedrooms,
          bathrooms: card.bathrooms,
          imageUrls: card.imageUrls,
          imageUrl: card.imageUrls[0],
          listingType: "For sale",
          agent: {
            name: "Brandon Levin",
            isVerified: true,
            phone: "(480) 555-0103",
            avatarUrl: "https://i.pravatar.cc/150?u=" + card.id,
            agency: "Turja Design Group, Inc.",
          },
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
