"use client";

import { ArrowRight, Building2 } from "lucide-react";

import { BlurImage } from "@/lib/motion/primitives";

import type { ListingCardModel } from "./lib/types";

type DesktopAreaSpotlightProps = {
  location: string;
  listingLabel: string;
  count: number;
  firstListing?: ListingCardModel;
  onOpenFirstListing: () => void;
};

function SpotlightImage({
  src,
  alt,
  sizes,
}: {
  src?: string;
  alt: string;
  sizes: string;
}) {
  if (!src) {
    return (
      <div className="flex size-full items-center justify-center bg-[var(--spotlight-panel)] text-[var(--spotlight-muted)]">
        <Building2 className="size-7" aria-hidden="true" />
      </div>
    );
  }

  return (
    <BlurImage
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      wrapperClassName="size-full"
      className="object-cover"
      fallback={(
        <div className="flex size-full items-center justify-center bg-[var(--spotlight-panel)] text-[var(--spotlight-muted)]">
          <Building2 className="size-7" aria-hidden="true" />
        </div>
      )}
    />
  );
}

export function DesktopAreaSpotlight({
  location,
  listingLabel,
  count,
  firstListing,
  onOpenFirstListing,
}: DesktopAreaSpotlightProps) {
  if (!firstListing) return null;

  const [primaryImage, secondaryImage] = firstListing.imageUrls;
  const singularListingLabel =
    listingLabel === "properties"
      ? "property"
      : listingLabel === "rentals"
        ? "rental"
        : listingLabel.replace(/s$/, "");
  const countCopy = `${count} ${count === 1 ? singularListingLabel : listingLabel} ${count === 1 ? "matches" : "match"} this map view.`;

  return (
    <section
      aria-label={`Explore ${listingLabel} in ${location}`}
      data-slot="desktop-area-spotlight"
      className="relative ml-6 mr-4 mt-[22px] min-h-[232px] overflow-hidden rounded-[var(--radius-panel)] border border-white/10 bg-[var(--spotlight-background)] px-6 py-[23px] text-[var(--spotlight-ink)] shadow-[var(--spotlight-shadow)]"
    >
      <div className="pointer-events-none absolute -bottom-16 -left-10 size-44 rotate-[-14deg] rounded-[36px] border border-white/5 bg-white/[0.025]" aria-hidden="true" />

      <div className="relative z-10 flex max-w-[62%] flex-col items-start">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--spotlight-muted)]">
          <span className="size-2 rounded-full bg-gold ring-4 ring-gold/15" aria-hidden="true" />
          Current area
        </p>
        <h2 className="mt-3 text-balance font-heading text-[23px] font-semibold leading-[1.08] tracking-[-0.025em]">
          Find a place in {location}.
        </h2>
        <p className="mt-2 max-w-[24ch] text-sm leading-5 text-[var(--spotlight-muted)]">{countCopy}</p>
        <button
          type="button"
          onClick={onOpenFirstListing}
          className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-gold/80 bg-gold px-4 text-sm font-semibold text-ink shadow-[var(--shadow-control)] transition-[background-color,box-shadow,transform] duration-[220ms] ease-[var(--ease-out-expo)] hover:bg-gold/90 hover:shadow-[var(--shadow-card)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spotlight-ink)] motion-reduce:transform-none motion-reduce:transition-colors"
        >
          View first home
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="absolute -right-2 bottom-1 top-1 w-[47%]" aria-hidden="true">
        <div className="absolute bottom-3 left-0 h-[70%] w-[76%] -rotate-[5deg] overflow-hidden rounded-[var(--radius-card)] border border-white/25 shadow-[var(--spotlight-image-shadow)]">
          <SpotlightImage
            src={primaryImage}
            alt=""
            sizes="180px"
          />
        </div>
        <div className="absolute right-0 top-3 h-[60%] w-[66%] rotate-[4deg] overflow-hidden rounded-[var(--radius-card)] border border-white/25 shadow-[var(--spotlight-image-shadow)]">
          <SpotlightImage
            src={secondaryImage ?? primaryImage}
            alt=""
            sizes="150px"
          />
        </div>
      </div>
    </section>
  );
}
