"use client";

import { DiscoveryCard, DiscoveryCardMapAction } from "@/components/premium/discovery-card";
import { DiscoveryDescription } from "@/features/discovery/discovery-description";
import type { ServiceFeed } from "./schema";

export function ServiceFeedCard({ item, selected, onShowOnMap }: {
  item: ServiceFeed["items"][number];
  selected?: boolean;
  onShowOnMap?: () => void;
}) {
  return (
    <DiscoveryCard
      category="service"
      title={item.content.title}
      location={item.content.address}
      emphasis={item.content.providerName}
      selected={selected}
      signals={[{ label: item.content.serviceType, description: "The advertised service category.", tone: "neutral" }]}
      description={<DiscoveryDescription text={item.content.description} />}
      actions={<>
        <a href={"tel:" + item.content.phone.replace(/[ ()-]/g, "")}
          className="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-forest underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Call {item.content.phone}
        </a>
        {onShowOnMap ? <DiscoveryCardMapAction onClick={onShowOnMap} selected={selected} /> : null}
      </>}
    />
  );
}

