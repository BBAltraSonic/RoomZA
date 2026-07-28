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
  previewed?: boolean;
  dimmed?: boolean;
  onPreviewChange?: (previewed: boolean) => void;
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
  presentation?: "standard" | "desktop-results";
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
export function ListingCard({
  card,
  selected,
  previewed,
  dimmed,
  onPreviewChange,
  onActivate,
  variant = "carousel",
  revealIndex = null,
  presentation = "standard",
}: ListingCardProps) {
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
      data-previewed={previewed ? "true" : "false"}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") onPreviewChange?.(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") onPreviewChange?.(false);
      }}
      onFocusCapture={() => onPreviewChange?.(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onPreviewChange?.(false);
      }}
      className={cn(
        isGrid ? "w-full" : "w-[88vw] max-w-[390px] shrink-0 snap-center",
        "rounded-xl transition-[opacity,transform] duration-[220ms] ease-[var(--ease-out-expo)]",
        previewed && !selected && "scale-[1.01] ring-2 ring-forest/25",
        dimmed && !previewed && "opacity-55",
        revealClass,
      )}
      style={reveal ? ({ "--stagger-index": revealIndex } as React.CSSProperties) : undefined}
    >
      <PropertyCard
        selected={selected}
        onSelect={onActivate}
        property={{
          id: card.id,
          title: card.title,
          area: card.area ?? distanceLabel,
          price: card.price,
          salePrice: card.salePrice,
          displayPrice: card.displayPrice,
          listingType: card.listingType,
          bedrooms: card.bedrooms,
          bathrooms: card.bathrooms,
          parkingCount: card.parkingCount,
          propertyType: card.propertyType,
          furnished: card.furnished,
          createdAt: card.createdAt,
          nsfasApproved: card.nsfasApproved,
          listingReviewedAt: card.listingReviewedAt,
          landlordTrust: card.landlordTrust,
          landlordPresence: card.landlordPresence,
          liveTourId: card.liveTourId,
          hasInstantViewing: card.hasInstantViewing,
          liveActivity: card.liveActivity,
          availabilityDate: card.availabilityDate,
          imageUrls: card.imageUrls,
          imageUrl: card.imageUrls[0],
          agent: card.agent,
        }}
        presentation={presentation}
        action={
          <SaveIconButton
            saved={favorited}
            onClick={(event) => {
              event.stopPropagation();
              toggleFavorite(card.id, { listingType: card.listingType });
            }}
          />
        }
      />
    </div>
  );
}
