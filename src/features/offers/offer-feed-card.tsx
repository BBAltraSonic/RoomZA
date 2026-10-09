"use client";

import { DiscoveryCard, DiscoveryCardMapAction } from "@/components/premium/discovery-card";
import { DiscoveryDescription } from "@/features/discovery/discovery-description";
import type { PublicLiveOffer } from "./public-contract";

const format = new Intl.DateTimeFormat("en-ZA", {
  timeZone: "Africa/Johannesburg", day: "numeric", month: "short",
  hour: "2-digit", minute: "2-digit", hour12: false,
});

export function OfferFeedCard({ item, selected, onShowOnMap }: {
  item: PublicLiveOffer;
  selected?: boolean;
  onShowOnMap?: () => void;
}) {
  return (
    <DiscoveryCard
      category="shopping"
      title={item.content.title}
      href={`/offers/${item.offerId}`}
      prefetch={false}
      location={item.content.address}
      emphasis={item.content.shopName}
      selected={selected}
      signals={[{ label: "Available now", description: "This confirmed special is currently live.", tone: "success" }]}
      description={<DiscoveryDescription text={item.content.benefit} className="text-sm leading-relaxed" />}
      metadata={<p>Ends {format.format(new Date(item.endsAt))} SAST</p>}
      actions={onShowOnMap ? <DiscoveryCardMapAction onClick={onShowOnMap} selected={selected} /> : undefined}
    />
  );
}

