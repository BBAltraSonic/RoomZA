import { discountPercent, formatDealPrice } from "@/features/discovery/deal-format";
import type { PublicEntry } from "@/features/entries/public-contract";
import type { PublicLiveOffer } from "@/features/offers/public-contract";
import type { PublicService, servicePriceUnits } from "@/features/services/schema";

import type { FactAnswer } from "./listing-facts";

/**
 * Questions about one special, event, place or service, answered from that item's own public
 * fields (docs/piko-character-bible.md, Phase 2). No AI: a fixed set of topics is matched by
 * rules, and anything the item doesn't state is "doesn't say", never a guess.
 */

export type ItemKind = "special" | "event" | "place" | "service";

type Timed = { startsAt: string; endsAt: string; priceCents?: number; originalPriceCents?: number };
export type PikoItem =
  | ({ kind: "special"; id: string; title: string; by: string; address: string; conditions?: string } & Timed)
  | ({ kind: "event" | "place"; id: string; title: string; by: string; address: string } & Timed)
  | {
      kind: "service";
      id: string;
      title: string;
      by: string;
      address: string;
      serviceType: string;
      priceFromCents?: number;
      priceUnit?: (typeof servicePriceUnits)[number];
    };

export const ITEM_TOPICS = ["price", "ends", "when", "where", "conditions", "service"] as const;
export type ItemTopic = (typeof ITEM_TOPICS)[number];

export type ItemQuestion = { label: string; topic: ItemTopic };

/** The preset questions shown as chips when Piko opens on an item. */
export const ITEM_QUESTIONS: Record<ItemKind, readonly ItemQuestion[]> = {
  special: [
    { label: "How much is it?", topic: "price" },
    { label: "When does it end?", topic: "ends" },
    { label: "Where is it?", topic: "where" },
    { label: "Any conditions?", topic: "conditions" },
  ],
  event: [
    { label: "When is it?", topic: "when" },
    { label: "How much is it?", topic: "price" },
    { label: "Where is it?", topic: "where" },
  ],
  place: [
    { label: "When can I go?", topic: "when" },
    { label: "How much is it?", topic: "price" },
    { label: "Where is it?", topic: "where" },
  ],
  service: [
    { label: "How much does it cost?", topic: "price" },
    { label: "What kind of service?", topic: "service" },
    { label: "Where are they?", topic: "where" },
  ],
};

/** What the item is called in "The special doesn't say." */
export const ITEM_NOUN: Record<ItemKind, string> = { special: "special", event: "event", place: "listing", service: "listing" };

/** Most specific first: "still on tomorrow" is about the end, not the start. */
const TOPIC_PATTERNS: [ItemTopic, RegExp][] = [
  ["conditions", /(?:\bconditions?\b|\bt\s?&\s?cs?\b|\bterms\b|\bcatch\b|\bfine print\b|\brules\b)/i],
  ["ends", /\b(?:ends?|ending|until|till|expires?|still on|last|how long)\b/i],
  ["price", /\b(?:how much|price|prices|cost|costs|free|pay|discount|cheap|rand)\b/i],
  ["where", /\b(?:where|address|location|directions)\b/i],
  ["when", /\b(?:when|what time|starts?|open|opening|times?|date)\b/i],
  ["service", /\b(?:what kind|what type|what service|what do they do|services?)\b/i],
];

export function matchItemTopic(text: string): ItemTopic | null {
  for (const [topic, pattern] of TOPIC_PATTERNS) if (pattern.test(text)) return topic;
  return null;
}

// The final "any" here is the English word in "any conditions?", not the TypeScript type.
const QUESTION_START = /^\s*(?:does|do|is|are|can|could|will|would|has|have|how|what|what's|whats|when|where|which|who|any)\b/i;

/** A question about the open item, rather than a new search. */
export function isItemQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return trimmed.endsWith("?") || (QUESTION_START.test(trimmed) && matchItemTopic(trimmed) !== null);
}

const ZONE = "Africa/Johannesburg";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dayName = new Intl.DateTimeFormat("en-ZA", { timeZone: ZONE, day: "numeric", month: "long" });
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hour12: false });

/** "today", "tomorrow" or "on 3 December", in Johannesburg time. */
function dayPhrase(at: Date, now: Date) {
  const day = dayKey.format(at);
  if (day === dayKey.format(now)) return "today";
  if (day === dayKey.format(new Date(now.getTime() + 86_400_000))) return "tomorrow";
  return `on ${dayName.format(at)}`;
}

const MAX_CONDITIONS = 300;
const UNIT: Record<(typeof servicePriceUnits)[number], string> = { job: "per job", hour: "an hour", callout: "call-out fee" };

export function answerItemFact(item: PikoItem, topic: ItemTopic, now = new Date()): FactAnswer {
  const known = (answer: string): FactAnswer => ({ known: true, answer });
  const unknown: FactAnswer = { known: false };

  if (item.kind === "service") {
    switch (topic) {
      case "price":
        return item.priceFromCents ? known(`From ${formatDealPrice(item.priceFromCents)}${item.priceUnit ? ` ${UNIT[item.priceUnit]}` : ""}.`) : unknown;
      case "service":
        return known(`${item.serviceType}, by ${item.by}.`);
      case "where":
        return known(`${item.by}, ${item.address}.`);
      default:
        return unknown;
    }
  }

  const start = new Date(item.startsAt);
  const end = new Date(item.endsAt);
  switch (topic) {
    case "price": {
      if (item.priceCents === undefined) return unknown;
      if (item.priceCents === 0) return known("It's free.");
      const off = discountPercent(item.priceCents, item.originalPriceCents);
      return known(
        off !== null && item.originalPriceCents
          ? `${formatDealPrice(item.priceCents)}, down from ${formatDealPrice(item.originalPriceCents)} (${off}% off).`
          : `${formatDealPrice(item.priceCents)}.`,
      );
    }
    case "ends":
      if (end.getTime() <= now.getTime()) return known("It has ended.");
      return known(`It ends ${dayPhrase(end, now)} at ${clock.format(end)}.`);
    case "when": {
      if (end.getTime() <= now.getTime()) return known("It has ended.");
      if (start.getTime() <= now.getTime()) return known(`It's on now, until ${dayPhrase(end, now)} at ${clock.format(end)}.`);
      const sameDay = dayKey.format(start) === dayKey.format(end);
      const until = sameDay ? `at ${clock.format(end)}` : `${dayPhrase(end, now)} at ${clock.format(end)}`;
      return known(`It starts ${dayPhrase(start, now)} at ${clock.format(start)} and ends ${until}.`);
    }
    case "where":
      return known(`${item.by}, ${item.address}.`);
    case "conditions": {
      if (item.kind !== "special" || !item.conditions?.trim()) return unknown;
      const text = item.conditions.trim();
      return known(text.length > MAX_CONDITIONS ? `${text.slice(0, MAX_CONDITIONS - 1).trimEnd()}…` : text);
    }
    case "service":
      return unknown;
  }
}

/**
 * The one-line "what it is" on a result card in the chat: price and timing for specials, events
 * and places; type and starting price for services. Only what the item states.
 */
export function itemSummary(item: PikoItem, now = new Date()): string {
  if (item.kind === "service") {
    const price = item.priceFromCents ? `From ${formatDealPrice(item.priceFromCents)}${item.priceUnit ? ` ${UNIT[item.priceUnit]}` : ""}` : null;
    return [item.serviceType, price].filter(Boolean).join(" · ");
  }
  const parts: string[] = [];
  if (item.priceCents === 0) parts.push("Free");
  else if (item.priceCents !== undefined) {
    const off = discountPercent(item.priceCents, item.originalPriceCents);
    parts.push(off !== null ? `${formatDealPrice(item.priceCents)}, ${off}% off` : formatDealPrice(item.priceCents));
  }
  const start = new Date(item.startsAt);
  const end = new Date(item.endsAt);
  if (end.getTime() <= now.getTime()) parts.push("Ended");
  else if (start.getTime() <= now.getTime()) parts.push(`Ends ${dayPhrase(end, now)} at ${clock.format(end)}`);
  else parts.push(`Starts ${dayPhrase(start, now)} at ${clock.format(start)}`);
  return parts.join(" · ");
}

type FeedItem = PublicLiveOffer | PublicEntry | PublicService;

/** The public fields Piko may answer from, for a special, event, place or service in the feed. */
export function pikoItemFromFeed(item: FeedItem): PikoItem {
  if ("offerId" in item) {
    const { content } = item;
    return {
      kind: "special", id: item.offerId, title: content.title, by: content.shopName, address: content.address,
      startsAt: content.startsAt, endsAt: content.endsAt, priceCents: content.priceCents, originalPriceCents: content.originalPriceCents,
      conditions: content.terms,
    };
  }
  if ("entryId" in item) {
    const { content } = item;
    return {
      kind: item.category === "event" ? "event" : "place", id: item.entryId, title: content.title, by: content.venueName,
      address: content.address, startsAt: content.startsAt, endsAt: content.endsAt, priceCents: content.priceCents,
      originalPriceCents: content.originalPriceCents,
    };
  }
  const { content } = item;
  return {
    kind: "service", id: item.id, title: content.title, by: content.providerName, address: content.address,
    serviceType: content.serviceType, priceFromCents: content.priceFromCents, priceUnit: content.priceUnit,
  };
}
