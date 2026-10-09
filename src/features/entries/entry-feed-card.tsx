"use client";

import { DiscoveryCard, DiscoveryCardMapAction } from "@/components/premium/discovery-card";
import { DiscoveryDescription } from "@/features/discovery/discovery-description";
import type { PublicEntry } from "./public-contract";
import { formatEntryTimeSast } from "./schema";

export function EntryFeedCard({ item, selected, onShowOnMap }: {
  item: PublicEntry;
  selected?: boolean;
  onShowOnMap?: () => void;
}) {
  const upcoming = item.state === "upcoming";
  return (
    <DiscoveryCard
      category={item.category}
      title={item.content.title}
      href={`/specials/${item.entryId}`}
      prefetch={false}
      location={item.content.address}
      emphasis={item.content.venueName}
      selected={selected}
      signals={[{
        label: upcoming ? "Upcoming" : "Available now",
        description: upcoming ? "This approved event has not started yet." : "This special is within its advertised dates.",
        tone: upcoming ? "info" : "success",
      }]}
      description={<DiscoveryDescription text={item.content.description} />}
      metadata={<p>{formatEntryTimeSast(item.content.startsAt)} – {formatEntryTimeSast(item.content.endsAt)}</p>}
      actions={onShowOnMap ? <DiscoveryCardMapAction onClick={onShowOnMap} selected={selected} /> : undefined}
    />
  );
}

