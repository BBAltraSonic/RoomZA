"use client";
import type { ReactNode } from "react";
import { BadgeCheck, Droplets, Hammer, Leaf, Sparkles, UserRound, Wrench, Zap } from "lucide-react";
import { ContactActions } from "@/features/guest-contact/contact-actions";
import { servicePublicContact } from "@/features/guest-contact/schema";
import { DiscoveryCard, DiscoveryCardMapAction, type CardPresentation, type DiscoveryCardSignal } from "@/components/premium/discovery-card";
import { formatDealPrice } from "@/features/discovery/deal-schema";
import { isNewListing } from "@/features/listings/listing-freshness";
import type { ServiceContent, ServiceFeed } from "./schema";
import { useServiceDetails } from "./service-details";

type ServiceItem = ServiceFeed["items"][number];

export function ServiceTypeIcon({ type, className = "size-3.5" }: { type: ServiceContent["serviceType"]; className?: string }) {
  const Icon = { Plumbing: Droplets, Electrical: Zap, Cleaning: Sparkles, Gardening: Leaf, Handyman: Hammer, Other: Wrench }[type] ?? Wrench;
  return <Icon className={className} aria-hidden="true" />;
}

/** The starting price leads, as rent does on a home; the unit sits beside it like "/month". */
export function servicePriceParts({ priceFromCents, priceUnit }: Pick<ServiceContent, "priceFromCents" | "priceUnit">): { emphasis: string; suffix?: string } {
  if (priceFromCents === undefined) return { emphasis: "Price on request" };
  if (priceUnit === "callout") return { emphasis: formatDealPrice(priceFromCents), suffix: "call-out" };
  return { emphasis: "From " + formatDealPrice(priceFromCents), suffix: priceUnit === "hour" ? "/hour" : priceUnit === "job" ? "/job" : undefined };
}

export function serviceSignals(item: ServiceItem, belowNearbyPercent?: number): DiscoveryCardSignal[] {
  const reviewed: DiscoveryCardSignal = {
    label: "Reviewed",
    description: `Service reviewed by Pinpoint on ${new Date(item.approved_at).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}. This does not verify identity or qualifications.`,
    tone: "success",
    icon: <BadgeCheck className="size-3 shrink-0" aria-hidden="true" />,
  };
  const value: DiscoveryCardSignal | null = belowNearbyPercent
    ? { label: `${belowNearbyPercent}% below nearby`, description: `Starts ${belowNearbyPercent}% below the typical price of similar services on the map.`, tone: "success" }
    : null;
  const fresh: DiscoveryCardSignal | null = isNewListing(item.approved_at)
    ? { label: "New", description: "Added within the last seven days.", tone: "neutral" }
    : null;
  return [reviewed, value, fresh].filter((signal): signal is DiscoveryCardSignal => signal !== null);
}

export function ServiceFeedCard({ item, selected, onShowOnMap, onOpenDetails, distance, belowNearbyPercent, presentation = "compact", action }: {
  item: ServiceItem;
  selected?: boolean;
  distance?: string;
  belowNearbyPercent?: number;
  onShowOnMap?: () => void;
  onOpenDetails?: () => void;
  presentation?: Exclude<CardPresentation, "responsive-results">;
  /** A control laid on the photo, such as the map preview's close button. */
  action?: ReactNode;
}) {
  const details = useServiceDetails();
  const price = servicePriceParts(item.content);
  return (
    <DiscoveryCard
      category="service"
      cardId={item.id}
      slotPrefix="service-card"
      presentation={presentation}
      onSelect={onOpenDetails ?? (details ? () => details.open(item.id) : undefined)}
      actionLabel={`View details for ${item.content.title}`}
      media={{ imageUrls: item.media?.map(image => image.url) ?? [], imageAlt: item.content.title, placeholder: <ServiceTypeIcon type={item.content.serviceType} className="size-10" />, action }}
      title={item.content.title}
      location={item.content.address + (distance ? " · " + distance : "")}
      emphasis={price.emphasis}
      emphasisSuffix={price.suffix}
      selected={selected || details?.id === item.id}
      features={<>
        <span className="inline-flex items-center gap-1"><ServiceTypeIcon type={item.content.serviceType} /><span>{item.content.serviceType}</span></span>
        <span className="inline-flex min-w-0 items-center gap-1"><UserRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="sr-only">Provider: </span><span className="truncate">{item.content.providerName}</span></span>
      </>}
      signals={serviceSignals(item, belowNearbyPercent)}
      signalsLabel="Service signals"
      actions={<>
        <ContactActions contact={servicePublicContact(item.content)} title={item.content.title} compact={presentation === "compact"} />
        {onShowOnMap ? <DiscoveryCardMapAction onClick={onShowOnMap} selected={selected} /> : null}
      </>}
    />
  );
}
