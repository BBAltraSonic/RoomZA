"use client";
import { MediaCarousel } from "./media-carousel";
import { formatDealPrice, discountPercent } from "./deal-schema";
export function PublishedMedia({ media, title, priceCents, originalPriceCents }: { media?: { id: string; url: string }[]; title: string; priceCents?: number; originalPriceCents?: number }) {
  const discount = discountPercent(priceCents, originalPriceCents);
  return <div className="space-y-3"><MediaCarousel media={media} title={title} />{priceCents !== undefined ? <div className="flex items-center gap-3"><strong className="rounded-xl bg-[oklch(87%_.19_112)] px-3 py-2 text-2xl text-[oklch(22%_.04_155)]">{formatDealPrice(priceCents)}</strong>{discount !== null ? <span><s className="text-sm text-muted-foreground">{formatDealPrice(originalPriceCents!)}</s><span className="block text-sm font-semibold text-forest">{discount}% off</span></span> : null}</div> : null}</div>;
}
