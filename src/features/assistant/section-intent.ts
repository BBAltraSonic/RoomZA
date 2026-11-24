import { parseSectionQuick, SECTION_QUICK_FILTERS, type SectionQuickKey } from "@/features/discovery/section-quick-filters";
import type { ViewportCategory } from "@/features/discovery/viewport-contract";
import { serviceTypes } from "@/features/services/schema";

/**
 * Customer search for the Specials, Places, Events and Services sections. Rules only: these
 * searches are a service type, the section's fixed quick filters, the Nearest sort and search
 * words, all already in the address. Nothing is sent to the AI.
 */

export type ServiceTypeValue = (typeof serviceTypes)[number];

export type SectionSearch = {
  serviceType?: ServiceTypeValue;
  quick: SectionQuickKey[];
  nearest: boolean;
  /** Words matched against titles and venues (the existing `q` search). */
  text: string;
};

const SERVICE_WORDS: [ServiceTypeValue, RegExp][] = [
  ["Plumbing", /\b(?:plumb(?:er|ers|ing)?|geysers?|leaks?|leaking|drains?|blocked)\b/gi],
  ["Electrical", /\b(?:electric(?:al|ian|ians)?|wiring|plugs?|sparky|db board|coc)\b/gi],
  ["Cleaning", /\b(?:clean(?:er|ers|ing)?|maids?|domestic workers?|helpers?)\b/gi],
  ["Gardening", /\b(?:garden(?:er|ers|ing)?|lawns?|grass cutting|tree felling)\b/gi],
  ["Handyman", /\b(?:handym[ae]n|odd jobs?|repairs?|fix(?:ing)?|painters?|painting)\b/gi],
];

const QUICK_WORDS: [SectionQuickKey, RegExp][] = [
  ["open-now", /\bopen(?: right)? now\b|\bavailable now\b/gi],
  ["on-now", /\b(?:on now|happening now|right now|live now)\b/gi],
  ["ending-today", /\b(?:ending|ends|expir(?:es|ing))\s+today\b|\blast day\b/gi],
  ["tonight", /\b(?:tonight|this evening)\b/gi],
  ["this-weekend", /\b(?:this weekend|the weekend|on the weekend|saturday|sunday)\b/gi],
  ["new-this-week", /\b(?:new(?: this week)?|latest|just added)\b/gi],
  ["below-nearby", /\b(?:cheap(?:er|est)?|affordable|budget|below (?:the )?nearby price|good price)\b/gi],
  ["free", /\b(?:free(?: entry)?|no charge|no cover)\b/gi],
];

const NEAREST = /\b(?:near(?:by| me)|close (?:by|to me)|around me|closest|nearest)\b/gi;

const FILLER = new Set([
  "a", "an", "the", "and", "or", "for", "to", "of", "in", "on", "at", "with", "me", "my", "i", "need", "want", "looking",
  "find", "show", "any", "anything", "something", "some", "please", "what's", "whats", "what", "is", "are", "there",
  "happening", "deals", "deal", "specials", "special", "events", "event", "services", "service", "places", "place",
  "today", "now", "this", "week", "good", "someone", "who", "can",
]);

export function parseSectionText(input: string, category: ViewportCategory): SectionSearch {
  let work = ` ${input} `;
  const allowed = SECTION_QUICK_FILTERS[category];
  const quick: SectionQuickKey[] = [];
  let serviceType: ServiceTypeValue | undefined;
  let nearest = false;

  if (category === "service") {
    for (const [type, pattern] of SERVICE_WORDS) {
      if (pattern.test(work)) {
        serviceType ??= type;
        work = work.replace(pattern, " | ");
      }
      pattern.lastIndex = 0;
    }
  }
  for (const [key, pattern] of QUICK_WORDS) {
    if (pattern.test(work)) {
      if (allowed.includes(key) && !quick.includes(key)) quick.push(key);
      work = work.replace(pattern, " | ");
    }
    pattern.lastIndex = 0;
  }
  if (NEAREST.test(work)) {
    nearest = true;
    work = work.replace(NEAREST, " | ");
  }
  NEAREST.lastIndex = 0;

  const text = work
    .split(/[^A-Za-z0-9'&-]+/)
    .filter((word) => word.length > 1 && !FILLER.has(word.toLowerCase()))
    .join(" ")
    .slice(0, 120);
  return { ...(serviceType ? { serviceType } : {}), quick, nearest, text };
}

export function readSectionSearch(params: URLSearchParams, category: ViewportCategory): SectionSearch {
  const type = params.get("serviceType");
  const serviceType = category === "service" && (serviceTypes as readonly string[]).includes(type ?? "") ? (type as ServiceTypeValue) : undefined;
  return {
    ...(serviceType ? { serviceType } : {}),
    quick: parseSectionQuick(params.get("quick"), category),
    nearest: params.get("sort") === "Nearest",
    text: (params.get("q") ?? "").slice(0, 120),
  };
}

/** Writes a section search into a copy of the address. The map area and section stay. */
export function applySectionSearch(base: URLSearchParams, search: SectionSearch): URLSearchParams {
  const next = new URLSearchParams(base.toString());
  for (const key of ["serviceType", "quick", "sort", "q", "detailId"]) next.delete(key);
  if (search.serviceType) next.set("serviceType", search.serviceType);
  if (search.quick.length) next.set("quick", search.quick.join(","));
  if (search.nearest) next.set("sort", "Nearest");
  if (search.text) next.set("q", search.text);
  return next;
}

export type SectionStarter = { label: string; search: SectionSearch; kind?: "event" };

export const SECTION_STARTERS: Record<ViewportCategory, SectionStarter[]> = {
  shopping: [
    { label: "Food deals near me", search: { quick: [], nearest: true, text: "food" } },
    { label: "Ending today", search: { quick: ["ending-today"], nearest: false, text: "" } },
    { label: "New this week", search: { quick: ["new-this-week"], nearest: false, text: "" } },
  ],
  tourism: [
    { label: "New this week", search: { quick: ["new-this-week"], nearest: false, text: "" } },
    { label: "Near me", search: { quick: [], nearest: true, text: "" } },
  ],
  event: [
    { label: "Tonight", search: { quick: ["tonight"], nearest: false, text: "" } },
    { label: "This weekend", search: { quick: ["this-weekend"], nearest: false, text: "" } },
    { label: "Free", search: { quick: ["free"], nearest: false, text: "" } },
  ],
  service: [
    { label: "Plumber", search: { serviceType: "Plumbing", quick: [], nearest: false, text: "" } },
    { label: "Cleaner", search: { serviceType: "Cleaning", quick: [], nearest: false, text: "" } },
    { label: "Open now", search: { quick: ["open-now"], nearest: false, text: "" } },
  ],
};
