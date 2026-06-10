"use client";

import { useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { Bath, BedDouble, Building2, MapPin, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ListingCardModel } from "../lib/types";
import { formatDistance, formatPrice, formatRating } from "../lib/format";

type ListingCardProps = {
  /** View model for the listing represented by this card. */
  card: ListingCardModel;
  /** Whether this card is the currently selected one (mirrors marker selection). */
  selected?: boolean;
  /** Invoked on tap / Enter / Space to open the listing detail view. */
  onActivate: () => void;
};

/**
 * ListingCard — a compact, fixed-width card for the horizontal Listing_Carousel
 * inside the Bottom_Sheet (Req 5.2–5.5).
 *
 * Layout (matching the reference design): listing photo on top, then title,
 * an optional star-rating + review-count strip, price, distance, and a
 * beds/baths summary. Activating the card (tap / Enter / Space) opens the
 * detail view via `onActivate`.
 *
 * The rating strip is rendered ONLY when both `card.rating` and
 * `card.reviewCount` are non-null (Req 5.2 — hidden when undeterminable).
 */
export function ListingCard({ card, selected, onActivate }: ListingCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const primaryImage = card.imageUrls.find(Boolean);
  const showImage = Boolean(primaryImage) && !imageFailed;
  const showRating = card.rating !== null && card.reviewCount !== null;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      onActivate();
    }
  };

  return (
    <button
      type="button"
      onClick={onActivate}
      onKeyDown={handleKeyDown}
      aria-label={`View details for ${card.title}`}
      aria-pressed={selected}
      className={cn(
        "group flex w-[260px] shrink-0 flex-col overflow-hidden rounded-[20px] bg-panel text-left shadow-sm transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2",
        selected ? "ring-2 ring-offset-2 ring-forest" : "ring-1 ring-border",
      )}
    >
      {/* Photo */}
      <div className="relative aspect-[5/3] w-full overflow-hidden bg-muted">
        {showImage ? (
          <Image
            src={primaryImage as string}
            alt={card.title}
            fill
            unoptimized
            sizes="260px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Building2 className="size-10" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-col gap-1.5 p-3">
        <h3 className="truncate text-sm font-bold leading-tight text-ink">
          {card.title}
        </h3>

        {showRating && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3.5 text-forest" fill="currentColor" strokeWidth={1} />
            <span className="font-semibold text-ink">{formatRating(card.rating as number)}</span>
            <span>({card.reviewCount})</span>
          </div>
        )}

        <div className="flex items-baseline">
          <span className="text-base font-extrabold tracking-tight text-ink">
            {formatPrice(card.price)}
          </span>
          <span className="ml-1 text-[10px] font-medium text-muted-foreground">/mo</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center text-muted-foreground">
            <MapPin className="mr-1 size-3 shrink-0 text-forest" fill="currentColor" strokeWidth={1} />
            <span className="text-[11px] font-medium tracking-tight">
              {card.distanceKm === null ? "Distance unavailable" : formatDistance(card.distanceKm)}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center">
              <BedDouble className="mr-0.5 size-3 text-forest" strokeWidth={1.5} />
              <span className="text-[10px] font-medium text-muted-foreground">{card.bedrooms}</span>
            </div>
            <div className="flex items-center">
              <Bath className="mr-0.5 size-3 text-forest" strokeWidth={1.5} />
              <span className="text-[10px] font-medium text-muted-foreground">{card.bathrooms}</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
