"use client";

import { ArrowRight } from "lucide-react";

import { AreaSpotlightImage, buildAreaSpotlightCountCopy } from "../area-spotlight-shared";
import type { ListingCardModel } from "../lib/types";

type MobileAreaSpotlightProps = {
  location: string;
  listingLabel: string;
  count: number;
  firstListing?: ListingCardModel;
  onOpenFirstListing: () => void;
};

export function MobileAreaSpotlight({
  location,
  listingLabel,
  count,
  firstListing,
  onOpenFirstListing,
}: MobileAreaSpotlightProps) {
  if (!firstListing) return null;

  const [primaryImage, secondaryImage] = firstListing.imageUrls;
  const countCopy = buildAreaSpotlightCountCopy({ count, listingLabel });

  return (
    <section
      aria-label={`Explore ${listingLabel} in ${location}`}
      data-slot="mobile-area-spotlight"
      className="relative mx-2 mb-3 h-[132px] overflow-hidden rounded-[var(--radius-panel)] border border-white/10 bg-[var(--spotlight-background)] px-4 py-2 text-[var(--spotlight-ink)] shadow-[var(--spotlight-shadow)]"
    >
      <div
        className="pointer-events-none absolute -bottom-14 -left-8 size-32 rotate-[-14deg] rounded-[28px] border border-white/5 bg-white/[0.025]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex h-full max-w-[63%] flex-col items-start">
        <p className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-[var(--spotlight-muted)]">
          <span className="size-1.5 rounded-full bg-gold ring-[3px] ring-gold/15" aria-hidden="true" />
          Current area
        </p>
        <h2 className="mt-1.5 line-clamp-2 text-balance font-heading text-[17px] font-semibold leading-[1.05] tracking-[-0.02em]">
          Find a place in {location}.
        </h2>
        <p className="mt-1 truncate text-[11px] leading-4 text-[var(--spotlight-muted)]">{countCopy}</p>
        <button
          type="button"
          onClick={onOpenFirstListing}
          className="mt-auto inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-gold/80 bg-gold px-3 text-xs font-semibold text-ink shadow-[var(--shadow-control)] transition-[background-color,box-shadow,transform] duration-[220ms] ease-[var(--ease-out-expo)] hover:bg-gold/90 hover:shadow-[var(--shadow-card)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spotlight-ink)] motion-reduce:transform-none motion-reduce:transition-colors"
        >
          View first home
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="absolute -right-1 inset-y-1 w-[43%]" aria-hidden="true">
        <div className="absolute bottom-2 left-0 h-[69%] w-[78%] -rotate-[5deg] overflow-hidden rounded-[var(--radius-card)] border border-white/25 shadow-[var(--spotlight-image-shadow)]">
          <AreaSpotlightImage src={primaryImage} sizes="132px" />
        </div>
        <div className="absolute right-0 top-2 h-[58%] w-[67%] rotate-[4deg] overflow-hidden rounded-[var(--radius-card)] border border-white/25 shadow-[var(--spotlight-image-shadow)]">
          <AreaSpotlightImage src={secondaryImage ?? primaryImage} sizes="112px" />
        </div>
      </div>
    </section>
  );
}
