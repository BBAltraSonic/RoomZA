import { discountPercent, formatDealPrice } from "@/features/discovery/deal-schema";
import type { ServiceContent } from "@/features/services/schema";

import { roundedActivityCount } from "../live-activity";

export type PinContent = { headline: string; detail?: string; tag?: string };

/** Infinite animations are only a signal while they stay rare, and each one costs a compositor layer. */
export const MAX_ANIMATED_PINS = 8;

const MAX_NAME_LENGTH = 22;
const MIN_COMPARABLE_HOMES = 5;
const MIN_BELOW_PERCENT = 5;
/** A gap this wide is more likely a bad listing than a bargain worth advertising. */
const MAX_BELOW_PERCENT = 50;

const PRICE_IN_TEXT = /(?:^|(?<=[\s(@:]))R\s?(\d{1,3}(?:[ ,]\d{3})+|\d+)(?:[.,](\d{2}))?(?![\d%])/i;
const DEAL_IN_TEXT = /\b(?:\d{1,2}% off|\d+ for \d+|half price|buy \d+ get \d+(?: free)?)\b/i;
const FILLER = new Set([
  "ad", "ads", "advert", "adverts", "advertisement", "at", "best", "daily", "deal", "deals", "for", "from", "great",
  "just", "now", "offer", "offers", "only", "our", "promo", "promos", "promotion", "promotions", "special", "specials",
  "the", "this", "today", "today's", "todays", "weekly", "@", "-", "–", "—",
]);

function isFiller(word: string) {
  return FILLER.has(word.toLowerCase().replace(/’/g, "'").replace(/[:,.!]+$/, ""));
}

function shortened(text: string) {
  if (text.length <= MAX_NAME_LENGTH) return text;
  const cut = text.slice(0, MAX_NAME_LENGTH - 1);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > 0 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}

/** What is actually on offer, without the price or advertising words around it. */
export function offerName(text: string) {
  const words = text.replace(PRICE_IN_TEXT, " ").replace(DEAL_IN_TEXT, " ").trim().split(/\s+/).filter(Boolean);
  while (words.length && isFiller(words[0]!)) words.shift();
  while (words.length && isFiller(words.at(-1)!)) words.pop();
  const name = words.join(" ").replace(/[:,.!]+$/, "");
  return name ? shortened(name[0]!.toUpperCase() + name.slice(1)) : undefined;
}

function priceInText(text: string) {
  const match = PRICE_IN_TEXT.exec(text);
  if (!match) return undefined;
  return Number(match[1]!.replace(/[ ,]/g, "")) * 100 + Number(match[2] ?? 0);
}

/** Businesses often type the price into the title, so it is recovered rather than lost. */
export function specialPriceCents({ title, benefit, priceCents }: { title: string; benefit?: string; priceCents?: number }) {
  return priceCents ?? priceInText(title) ?? (benefit ? priceInText(benefit) : undefined);
}

export function specialPinContent({ title, benefit, identity, priceCents, originalPriceCents }: {
  title: string;
  benefit?: string;
  identity?: string;
  priceCents?: number;
  originalPriceCents?: number;
}): PinContent {
  const cents = specialPriceCents({ title, benefit, priceCents });
  const deal = (DEAL_IN_TEXT.exec(title) ?? (benefit ? DEAL_IN_TEXT.exec(benefit) : null))?.[0];
  const name = offerName(title) ?? (benefit ? offerName(benefit) : undefined);
  const discount = discountPercent(priceCents, originalPriceCents);
  const headline = (cents === undefined ? deal ?? name : formatDealPrice(cents)) ?? identity ?? shortened(title);
  const detail = [name, identity].find(value => value && value !== headline);
  const tag = discount === null ? (cents === undefined ? undefined : deal) : `${discount}% off`;
  return { headline, ...(detail ? { detail } : {}), ...(tag ? { tag } : {}) };
}

const SOUTH_AFRICA = "Africa/Johannesburg";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: SOUTH_AFRICA, year: "numeric", month: "2-digit", day: "2-digit" });
const clockTime = new Intl.DateTimeFormat("en-GB", { timeZone: SOUTH_AFRICA, hour: "2-digit", minute: "2-digit", hour12: false });
const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: SOUTH_AFRICA, weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { timeZone: SOUTH_AFRICA, day: "numeric", month: "short" });

/** When an event happens, in the words someone would plan an evening with. */
export function eventWhenLabel(startsAt: string, endsAt: string, now: number) {
  const start = Date.parse(startsAt);
  if (now >= Date.parse(endsAt)) return "Ended";
  if (now >= start) return "On now";
  const days = (Date.parse(dayKey.format(start)) - Date.parse(dayKey.format(now))) / 86_400_000;
  if (days === 0) return `Today ${clockTime.format(start)}`;
  if (days === 1) return `Tomorrow ${clockTime.format(start)}`;
  return days < 7 ? `${weekday.format(start)} ${clockTime.format(start)}` : dayMonth.format(start);
}

const SERVICE_ROLES: Record<ServiceContent["serviceType"], string | null> = {
  Plumbing: "Plumber",
  Electrical: "Electrician",
  Cleaning: "Cleaner",
  Gardening: "Gardener",
  Handyman: "Handyman",
  Other: null,
};

export function formatServicePrice(cents: number, unit?: ServiceContent["priceUnit"]) {
  if (unit === "callout") return `${formatDealPrice(cents)} call-out`;
  return `From ${formatDealPrice(cents)}${unit === "hour" ? "/hr" : ""}`;
}

export function servicePinContent({ title, providerName, serviceType, priceFromCents, priceUnit }: Pick<ServiceContent, "title" | "providerName" | "serviceType" | "priceFromCents" | "priceUnit">): PinContent {
  const role = SERVICE_ROLES[serviceType] ?? offerName(title) ?? providerName;
  return priceFromCents === undefined
    ? { headline: role, detail: providerName }
    : { headline: formatServicePrice(priceFromCents, priceUnit), detail: role };
}

export function formatPinDistance(km: number) {
  const metres = Math.max(50, Math.round((km * 1000) / 50) * 50);
  if (metres < 1000) return `${metres} m`;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Percent below the median of comparable results, only where the comparison is fair. */
export function belowNearbyPercents<T extends { id: string }>(items: readonly T[], { group, price }: { group: (item: T) => string; price: (item: T) => number | undefined }) {
  const groups = new Map<string, { id: string; price: number }[]>();
  for (const item of items) {
    const value = price(item);
    if (!value || value <= 0) continue;
    const key = group(item);
    groups.set(key, [...(groups.get(key) ?? []), { id: item.id, price: value }]);
  }
  const percents = new Map<string, number>();
  for (const members of groups.values()) {
    if (members.length < MIN_COMPARABLE_HOMES) continue;
    const typical = median(members.map(member => member.price));
    for (const member of members) {
      const percent = Math.round(((typical - member.price) / typical) * 100);
      if (percent >= MIN_BELOW_PERCENT && percent <= MAX_BELOW_PERCENT) percents.set(member.id, percent);
    }
  }
  return percents;
}

export function viewingNowLabel(viewingNow?: number) {
  if (!viewingNow || viewingNow < 2) return undefined;
  return viewingNow < 5 ? "A few viewing" : `About ${roundedActivityCount(viewingNow)} viewing`;
}

export function animatedPinIds(pins: readonly { id: string; attention: number }[], limit = MAX_ANIMATED_PINS) {
  return new Set(pins.filter(pin => pin.attention > 0).sort((a, b) => b.attention - a.attention).slice(0, limit).map(pin => pin.id));
}

/** Staggers pulses by listing so the map never flashes in unison. */
export function pinPulseDelay(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) % 2400;
  return `-${hash}ms`;
}
