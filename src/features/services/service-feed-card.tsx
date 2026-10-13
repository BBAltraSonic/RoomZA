"use client";
import { ContactActions } from "@/features/guest-contact/contact-actions";
import { servicePublicContact } from "@/features/guest-contact/schema";

import { Wrench } from "lucide-react";
import { DiscoveryCard, DiscoveryCardMapAction } from "@/components/premium/discovery-card";
import { DiscoveryDescription } from "@/features/discovery/discovery-description";
import type { ServiceFeed } from "./schema";
import { useServiceDetails } from "./service-details";

export function ServiceFeedCard({ item, selected, onShowOnMap, onOpenDetails, distance }: {
  item: ServiceFeed["items"][number];
  selected?: boolean;
  distance?: string;
  onShowOnMap?: () => void;
  onOpenDetails?: () => void;
}) {
  const details = useServiceDetails();
  return (
    <DiscoveryCard
      category="service"
      cardId={item.id}
      onSelect={onOpenDetails ?? (details ? () => details.open(item.id) : undefined)}
      actionLabel={`View details for ${item.content.title}`}
      media={{ imageUrls: item.media?.map(image => image.url) ?? [], imageAlt: item.content.title, placeholder: <Wrench className="size-10" aria-hidden="true" /> }}
      title={item.content.title}
      location={item.content.address + (distance ? " · " + distance : "")}
      emphasis={item.content.providerName}
      selected={selected || details?.id === item.id}
      signals={[{ label: item.content.serviceType, description: "The advertised service category.", tone: "neutral" }]}
      description={<DiscoveryDescription text={item.content.description} />}
      actions={<>
        <ContactActions contact={servicePublicContact(item.content)} title={item.content.title} />
        {onShowOnMap ? <DiscoveryCardMapAction onClick={onShowOnMap} selected={selected} /> : null}
      </>}
    />
  );
}

