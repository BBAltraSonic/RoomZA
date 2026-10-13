"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { OfferFeedCard } from "@/features/offers/offer-feed-card";
import { EntryFeedCard } from "@/features/entries/entry-feed-card";
import type { PublicLiveOffer } from "@/features/offers/public-contract";
import type { PublicEntry } from "@/features/entries/public-contract";
import { DiscoveryClock, useDiscoveryNow } from "./discovery-clock";
import { SavedSpecialsProvider, useSavedSpecial, type SavedSpecialTarget } from "./saved-specials-client";
type SavedItem = SavedSpecialTarget & { item: PublicLiveOffer | PublicEntry | null };
function SavedSpecialRow({ value }: { value: SavedItem }) {
  const save = useSavedSpecial(value, value.item?.savedCount ?? 0), now = useDiscoveryNow(), router = useRouter();
  const expired = Boolean(value.item && now !== null && now >= Date.parse("offerId" in value.item ? value.item.endsAt : value.item.content.endsAt));
  useEffect(() => { if (expired) router.refresh(); }, [expired, router]);
  if (!save.saved) return null;
  if (!value.item || expired) return <article className="rounded-xl border border-border bg-panel p-4"><h2 className="font-semibold">Special unavailable</h2><p className="mt-1 text-sm text-muted-foreground">This saved Special has expired or is no longer published.</p><button type="button" disabled={save.pending} className="mt-2 min-h-11 text-sm text-forest underline" onClick={() => void save.remove()}>Remove from saved Specials</button></article>;
  return "offerId" in value.item ? <OfferFeedCard item={value.item} /> : <EntryFeedCard item={value.item} />;
}
export function SavedSpecialsGrid({ items, serverNow }: { items: SavedItem[]; serverNow: string }) {
  return <DiscoveryClock serverNow={serverNow}><SavedSpecialsProvider initialTargets={items}><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{items.map(value => <SavedSpecialRow key={value.category + value.id} value={value} />)}</div></SavedSpecialsProvider></DiscoveryClock>;
}
