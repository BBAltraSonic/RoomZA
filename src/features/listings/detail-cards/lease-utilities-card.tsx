import { CalendarDays, Droplets } from "lucide-react";

import { leaseDurationLabels, propertyTypeLabels, waterTypeLabels } from "@/features/listings/schema";

import { formatListingDate } from "./format";
import type { ListingDetail } from "./types";

type LeaseListing = Pick<
  ListingDetail,
  "listing_type" | "property_type" | "lease_duration" | "water_availability" | "created_at" | "availability_date"
>;

/** Lease terms and utilities for a rental; type and listed date for a sale. */
export function LeaseUtilitiesCard({ listing }: { listing: LeaseListing }) {
  const isSale = listing.listing_type === "sale";

  return (
    <section className="rounded-xl border border-border bg-warm-surface p-4 sm:rounded-lg">
      <h2 className="text-sm font-semibold text-ink">{isSale ? "Property details" : "Lease and utilities"}</h2>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{isSale ? "Type" : "Lease"}</span>
          <span className="text-right font-medium text-ink">
            {isSale
              ? propertyTypeLabels[listing.property_type as keyof typeof propertyTypeLabels] ?? listing.property_type ?? "Property"
              : leaseDurationLabels[listing.lease_duration as keyof typeof leaseDurationLabels] ?? listing.lease_duration}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Droplets className="size-4" />
            Water
          </span>
          <span className="text-right font-medium text-ink">
            {waterTypeLabels[listing.water_availability as keyof typeof waterTypeLabels] ?? listing.water_availability}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays className="size-4" />
            {isSale ? "Listed" : "Available"}
          </span>
          <span className="text-right font-medium text-ink">{formatListingDate(isSale ? listing.created_at : listing.availability_date)}</span>
        </div>
      </div>
    </section>
  );
}
