import type { PublicEntry } from "@/features/entries/public-contract";
import { entryDirectionsSchema, publicEntryDetailSchema } from "@/features/entries/public-contract";
import type { PublicOfferDetail } from "@/features/offers/public-contract";
import { publicOfferDetailSchema, publicOfferDirectionsSchema } from "@/features/offers/public-contract";
import { readPublicContact, type PublicContact } from "@/features/guest-contact/schema";
import type { SavedSpecialTarget, SpecialCategory } from "./saved-specials-client";
import type { SpecialLinks } from "./special-link-schema";

export type SpecialDetailTarget = { id: string; category: SpecialCategory | "entry" };
export type SpecialDetailData = SpecialLinks & SavedSpecialTarget & {
  title: string; description: string; identity: string; address: string;
  startsAt: string; endsAt: string; href: string; contact: PublicContact | null;
  priceCents?: number; originalPriceCents?: number; media?: { id: string; url: string }[];
  savedCount?: number; terms?: string; confirmedAt?: string;
  poster?: { displayName: string; username: string } | null;
};
export type SpecialDetailState = {
  item: SpecialDetailData | null;
  status: "live" | "upcoming" | "scheduled" | "expired" | "unavailable";
  serverNow: string; startsAt?: string; endsAt?: string;
};
export function entryDetailData(item: PublicEntry): SpecialDetailData {
  const c = item.content;
  return { ...c, id: item.entryId, category: item.category, identity: c.venueName, href: "/specials/" + item.entryId,
    contact: readPublicContact(c.publicContact, c.contactConsent), media: item.media, savedCount: item.savedCount };
}
export function offerDetailState(offer: PublicOfferDetail): SpecialDetailState {
  return { status: offer.status, serverNow: offer.serverNow,
    ...("startsAt" in offer ? { startsAt: offer.startsAt, endsAt: offer.endsAt } : {}),
    item: offer.status === "live" ? { ...offer.content, id: offer.offerId, category: "shopping", description: offer.content.benefit,
      identity: offer.content.shopName, startsAt: offer.startsAt, endsAt: offer.endsAt, href: "/offers/" + offer.offerId,
      contact: readPublicContact(offer.content.publicContact, offer.content.contactConsent), media: offer.media,
      savedCount: offer.savedCount, confirmedAt: offer.confirmedAt, poster: offer.poster } : null };
}
export function parseSpecialDetail(target: SpecialDetailTarget, value: unknown): SpecialDetailState {
  if (target.category === "shopping") {
    const offer = publicOfferDetailSchema.parse(value);
    if ("offerId" in offer && offer.offerId !== target.id) throw new Error("Wrong offer");
    return offerDetailState(offer);
  }
  const result = publicEntryDetailSchema.parse(value), item = result.item;
  if (item && (item.entryId !== target.id || (target.category !== "entry" && item.category !== target.category))) throw new Error("Wrong special");
  return { status: item?.state ?? "unavailable", serverNow: result.serverNow, item: item ? entryDetailData(item) : null,
    startsAt: item?.content.startsAt, endsAt: item?.content.endsAt };
}
export const specialApiPath = (target: SpecialDetailTarget) => `/api/${target.category === "shopping" ? "offers" : "entries"}/${target.id}`;

/** Directions endpoints return JSON; only a current, validated destination can be opened. */
export async function openSpecialDirections(target: SpecialDetailTarget, signal: AbortSignal, deadline: number, navigate = (url: string) => window.location.assign(url)) {
  const started = performance.now();
  if (started >= deadline) throw new Error("Special ended");
  const response = await fetch(specialApiPath(target) + "/directions", { cache: "no-store", headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error("Directions unavailable");
  const raw: unknown = await response.json();
  const value = target.category === "shopping" ? publicOfferDirectionsSchema.parse(raw) : entryDirectionsSchema.parse(raw);
  if (signal.aborted) return;
  if (Date.parse(value.endsAt) - Date.parse(value.serverNow) <= performance.now() - started || performance.now() >= deadline) throw new Error("Special ended");
  navigate("destination" in value ? value.destination : value.url);
}
