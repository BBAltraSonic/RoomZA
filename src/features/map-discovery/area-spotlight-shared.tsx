import { Building2 } from "lucide-react";

import { BlurImage } from "@/lib/motion/primitives";

export function buildAreaSpotlightCountCopy({
  count,
  listingLabel,
}: {
  count: number;
  listingLabel: string;
}) {
  const singularListingLabel =
    listingLabel === "properties"
      ? "property"
      : listingLabel === "rentals"
        ? "rental"
        : listingLabel.replace(/s$/, "");

  return `${count} ${count === 1 ? singularListingLabel : listingLabel} ${count === 1 ? "matches" : "match"} this map view.`;
}

export function AreaSpotlightImage({
  src,
  sizes,
}: {
  src?: string;
  sizes: string;
}) {
  const placeholder = (
    <div
      data-slot="area-spotlight-image-placeholder"
      className="flex size-full items-center justify-center bg-[var(--spotlight-panel)] text-[var(--spotlight-muted)]"
    >
      <Building2 className="size-7" aria-hidden="true" />
    </div>
  );

  if (!src) return placeholder;

  return (
    <BlurImage
      src={src}
      alt=""
      fill
      sizes={sizes}
      wrapperClassName="size-full"
      className="object-cover"
      fallback={placeholder}
    />
  );
}
