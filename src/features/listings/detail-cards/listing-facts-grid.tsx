import { Bath, BedDouble, Car, Sofa } from "lucide-react";

import { parkingTypeLabels, propertyTypeLabels } from "@/features/listings/schema";
import { cn } from "@/lib/utils";

import type { ListingDetail } from "./types";

type FactsListing = Pick<ListingDetail, "property_type" | "bedrooms" | "bathrooms" | "parking_type" | "metadata">;

const tileClass =
  "flex flex-col items-center rounded-xl border border-border bg-warm-surface px-2 py-3 text-center sm:flex-row sm:items-center sm:gap-3 sm:rounded-md sm:px-3 sm:py-2.5 sm:text-left";

/** Four key facts as tiles: type and bedrooms, bathrooms, parking, furnishing. */
export function ListingFactsGrid({ listing, compact }: { listing: FactsListing; compact?: boolean }) {
  const furnished = Boolean(listing.metadata?.amenities?.essentials?.includes("furnished"));

  return (
    <div className={cn("grid grid-cols-2 gap-2", compact ? "" : "sm:grid-cols-4 sm:gap-3")}>
      {/* Type — property type with the room/bedroom count as the sub-label */}
      <div className={tileClass}>
        <BedDouble className="size-5 text-forest sm:size-4" />
        <div className="mt-1.5 sm:mt-0">
          <p className="text-sm font-semibold text-ink">
            {propertyTypeLabels[listing.property_type as keyof typeof propertyTypeLabels] ?? listing.property_type ?? "Home"}
          </p>
          <p className="text-[0.65rem] text-muted-foreground sm:text-xs">
            {listing.bedrooms > 0
              ? `${listing.bedrooms} ${listing.bedrooms === 1 ? "Bedroom" : "Bedrooms"}`
              : "Open plan"}
          </p>
        </div>
      </div>

      <div className={tileClass}>
        <Bath className="size-5 text-forest sm:size-4" />
        <div className="mt-1.5 sm:mt-0">
          <p className="text-sm font-semibold text-ink">{listing.bathrooms}</p>
          <p className="text-[0.65rem] text-muted-foreground sm:text-xs">
            {listing.bathrooms === 1 ? "Bathroom" : "Bathrooms"}
          </p>
        </div>
      </div>

      <div className={tileClass}>
        <Car className="size-5 text-forest sm:size-4" />
        <div className="mt-1.5 sm:mt-0">
          <p className="text-sm font-semibold text-ink">{parkingTypeLabels[listing.parking_type as keyof typeof parkingTypeLabels] ?? listing.parking_type}</p>
          <p className="text-[0.65rem] text-muted-foreground sm:text-xs">Parking</p>
        </div>
      </div>

      {/* Furnished — derived from the essentials amenities. */}
      <div className={tileClass}>
        <Sofa className="size-5 text-forest sm:size-4" />
        <div className="mt-1.5 sm:mt-0">
          <p className="text-sm font-semibold text-ink">{furnished ? "Furnished" : "Unfurnished"}</p>
          <p className="text-[0.65rem] text-muted-foreground sm:text-xs">{furnished ? "Move-in ready" : "Bring your own"}</p>
        </div>
      </div>
    </div>
  );
}
