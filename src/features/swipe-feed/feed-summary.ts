import type { ListingDetail } from "@/features/listings/detail-cards/types";
import { propertyTypeLabels } from "@/features/listings/schema";
import type { ListingCardModel } from "@/features/map-discovery/lib/types";
import { formatPrice } from "@/lib/utils";

/** What a feed card needs to draw its photo and headline before full details arrive. */
export type FeedSummary = {
  id: string;
  title: string;
  area: string | null;
  imageUrls: string[];
  price: number;
  listingType: "rent" | "sale";
  bedrooms: number;
  bathrooms: number;
  propertyType: string | null;
};

export function toFeedSummary(card: ListingCardModel): FeedSummary {
  const listingType = card.listingType ?? "rent";
  return {
    id: card.id,
    title: card.title,
    area: card.area ?? null,
    imageUrls: card.imageUrls,
    price: card.displayPrice ?? (listingType === "sale" ? card.salePrice ?? card.price : card.price),
    listingType,
    bedrooms: card.bedrooms,
    bathrooms: card.bathrooms,
    propertyType: card.propertyType ?? null,
  };
}

/** For a listing opened by link that is not in the current results. */
export function summaryFromDetail(detail: ListingDetail): FeedSummary {
  const listingType = detail.listing_type ?? "rent";
  return {
    id: detail.id,
    title: detail.title,
    area: detail.address ?? null,
    imageUrls: [...(detail.images ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((image) => image.public_url),
    price: detail.display_price ?? (listingType === "sale" ? detail.sale_price ?? detail.price : detail.price),
    listingType,
    bedrooms: Number(detail.bedrooms ?? 0),
    bathrooms: Number(detail.bathrooms ?? 0),
    propertyType: detail.property_type ?? null,
  };
}

export function summaryPrice(summary: Pick<FeedSummary, "price" | "listingType">) {
  return { amount: formatPrice(summary.price), suffix: summary.listingType === "sale" ? null : "/month" };
}

export function summaryFacts(summary: Pick<FeedSummary, "bedrooms" | "bathrooms" | "propertyType">) {
  const type = summary.propertyType
    ? propertyTypeLabels[summary.propertyType as keyof typeof propertyTypeLabels] ?? summary.propertyType
    : null;
  return [
    summary.bedrooms > 0 ? `${summary.bedrooms} bed` : "Open plan",
    `${summary.bathrooms} ${summary.bathrooms === 1 ? "bath" : "baths"}`,
    type,
  ].filter(Boolean).join(" · ");
}
