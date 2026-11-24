import { parseSearchText } from "../search-intent";
import type { PeopleFilters, Stage } from "./people";

/**
 * AI job 2's rules half: what a lister typed -> a business template and its filters
 * (proposal, "Where AI is used"). Common phrases are recognised here. People's names are
 * matched against the lister's own list by Pinpoint and never reach the AI; listing titles
 * are matched the same way. Only what the rules can't place is worth asking the AI.
 */

export const BUSINESS_TEMPLATES = [
  "today",
  "people_list",
  "person_detail",
  "question_insights",
  "new_listing",
  "quality_check",
  "improve_listing",
  "performance",
  "change_preview",
  "viewing_slots",
  "reminders",
] as const;
export type BusinessTemplate = (typeof BUSINESS_TEMPLATES)[number];

export const CHANGE_KINDS = ["accept_viewings", "decline_viewing", "review_applications", "confirm_bookings", "mark_let", "change_price", "archive_quiet"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

export type ChangeRequest =
  | { kind: "accept_viewings" | "review_applications" | "confirm_bookings"; listingId?: string; personKey?: string }
  | { kind: "archive_quiet"; listingId?: string }
  | { kind: "decline_viewing"; personKey: string }
  | { kind: "mark_let"; listingId?: string }
  | { kind: "change_price"; listingId?: string; percent?: number; amount?: number };

export type NewListingDraft = {
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  price?: number;
  listingType?: "rent" | "sale";
  area?: string;
  /** What the lister typed, contact details already removed. Shown to the writing job only. */
  notes: string;
};

export type ReminderRequest = { text: string; due: "today" | "tomorrow" | "next-week" | "friday" | null };

export type BusinessRequest =
  | { template: "today" }
  | { template: "people_list"; filters: PeopleFilters }
  | { template: "person_detail"; personKey: string }
  | { template: "question_insights"; listingId?: string }
  | { template: "new_listing"; draft: NewListingDraft }
  | { template: "quality_check"; listingId?: string }
  | { template: "improve_listing"; listingId: string }
  | { template: "performance"; listingId?: string }
  | { template: "change_preview"; change: ChangeRequest }
  | { template: "viewing_slots"; personKey?: string }
  | { template: "reminders"; create?: ReminderRequest };

export type KnownPerson = { key: string; name: string };
export type KnownListing = { id: string; title: string };

export type RuleResult = { request: BusinessRequest; source: "rules" } | { request: null; source: "rules"; textForAi: string };

function normalize(value: string) {
  return value.toLocaleLowerCase("en-ZA").replace(/[^a-z0-9]+/g, " ").trim();
}

function contains(haystack: string, needle: string) {
  return needle.length > 0 && ` ${haystack} `.includes(` ${needle} `);
}

/** A person the lister named: full name first, then a first name only when it's unambiguous. */
export function matchPerson(text: string, people: readonly KnownPerson[]): KnownPerson | null {
  const words = normalize(text);
  const full = people.filter((person) => person.name && contains(words, normalize(person.name)));
  if (full.length === 1) return full[0]!;
  const byFirst = people.filter((person) => {
    const first = normalize(person.name).split(" ")[0] ?? "";
    return first.length >= 3 && contains(words, first);
  });
  const distinct = new Map(byFirst.map((person) => [normalize(person.name), person]));
  return distinct.size === 1 ? byFirst[0]! : null;
}

/** Replaces the lister's people's names with a placeholder before anything can leave Pinpoint. */
export function maskNames(text: string, people: readonly KnownPerson[]): string {
  let masked = text;
  const names = new Set<string>();
  for (const person of people) {
    const parts = person.name.trim().split(/\s+/).filter((part) => part.length >= 3);
    names.add(person.name.trim());
    for (const part of parts) names.add(part);
  }
  for (const name of [...names].filter(Boolean).sort((a, b) => b.length - a.length)) {
    masked = masked.replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "[person]");
  }
  return masked;
}

export function matchListing(text: string, listings: readonly KnownListing[]): KnownListing | null {
  const words = normalize(text);
  const matches = listings.filter((listing) => {
    const title = normalize(listing.title);
    return title.length >= 4 && contains(words, title);
  });
  return matches.length === 1 ? matches[0]! : null;
}

function since(text: string): PeopleFilters["since"] | undefined {
  if (/\btoday\b/i.test(text)) return "today";
  if (/\b(?:this|past|last) week\b/i.test(text)) return "week";
  if (/\b(?:this|past|last) month\b/i.test(text)) return "month";
  return undefined;
}

function stage(text: string): Stage | undefined {
  if (/\b(?:gone quiet|went quiet|quiet|ghosted|stopped replying|no reply)\b/i.test(text)) return "gone-quiet";
  if (/\b(?:ready to apply|follow[- ]?up)\b/i.test(text)) return "ready-to-apply";
  if (/\b(?:applied|applicants?|applications?)\b/i.test(text)) return "applied";
  if (/\b(?:viewings? booked|booked viewings?)\b/i.test(text)) return "viewing-booked";
  if (/\b(?:just enquired|new enquir(?:y|ies)|new leads?)\b/i.test(text)) return "just-enquired";
  return undefined;
}

function reminderDue(text: string): ReminderRequest["due"] {
  if (/\btomorrow\b/i.test(text)) return "tomorrow";
  if (/\bnext week\b/i.test(text)) return "next-week";
  if (/\bfriday\b/i.test(text)) return "friday";
  if (/\btoday|tonight|later\b/i.test(text)) return "today";
  return null;
}

export function parseBusinessText(text: string, context: { people: readonly KnownPerson[]; listings: readonly KnownListing[] }): RuleResult {
  const trimmed = text.trim();
  const done = (request: BusinessRequest): RuleResult => ({ request, source: "rules" });
  const listing = matchListing(trimmed, context.listings);
  const listingId = listing?.id;

  // Reminders first: "remind me to call Thandi tomorrow" names a person but is a reminder.
  const remind = trimmed.match(/^\s*(?:please\s+)?remind me (?:to\s+)?(.+)$/i);
  if (remind) {
    const due = reminderDue(remind[1]!);
    const body = remind[1]!.replace(/\b(?:tomorrow|next week|on friday|friday|today|tonight|later)\b/gi, "").replace(/\s+/g, " ").trim();
    return done({ template: "reminders", create: { text: body.slice(0, 200), due: due ?? "tomorrow" } });
  }
  if (/^\s*(?:my\s+)?reminders?\b|\bwhat (?:did|have) i (?:set|asked)\b/i.test(trimmed)) return done({ template: "reminders" });

  // Changes the lister wants made (always previewed, never run here).
  if (/\baccept (?:all |the )?(?:viewing|showing)s?(?: requests?)?\b/i.test(trimmed)) return done({ template: "change_preview", change: { kind: "accept_viewings", ...(listingId ? { listingId } : {}) } });
  if (/\bconfirm (?:all |the )?bookings?\b/i.test(trimmed)) return done({ template: "change_preview", change: { kind: "confirm_bookings" } });
  if (/\b(?:review|move along|move forward) (?:the |all |new )?applications?\b/i.test(trimmed)) return done({ template: "change_preview", change: { kind: "review_applications", ...(listingId ? { listingId } : {}) } });
  if (/\barchive\b.*\b(?:quiet|gone quiet|inactive|old)\b/i.test(trimmed)) return done({ template: "change_preview", change: { kind: "archive_quiet" } });
  if (/\b(?:mark(?:ed)?|it'?s|is now|has been) (?:as )?(?:let|rented|taken)\b/i.test(trimmed)) return done({ template: "change_preview", change: { kind: "mark_let", ...(listingId ? { listingId } : {}) } });
  const pricePercent = trimmed.match(/\b(raise|increase|up|lower|reduce|drop|decrease|cut)\b[^%\d]*(?:prices?|rent)?[^%\d]*(\d{1,2})\s?%/i);
  if (pricePercent) {
    const sign = /raise|increase|up/i.test(pricePercent[1]!) ? 1 : -1;
    return done({ template: "change_preview", change: { kind: "change_price", percent: sign * Number(pricePercent[2]), ...(listingId ? { listingId } : {}) } });
  }
  const priceTo = trimmed.match(/\b(?:change|set|make) (?:the )?(?:price|rent)(?: of [^\d]+?)? to\s*r?\s?(\d[\d ,]*)(k)?\b/i);
  if (priceTo) {
    const amount = Number(priceTo[1]!.replace(/[ ,]/g, "")) * (priceTo[2] ? 1000 : 1);
    if (amount > 0) return done({ template: "change_preview", change: { kind: "change_price", amount, ...(listingId ? { listingId } : {}) } });
  }
  const decline = trimmed.match(/\bdecline\b/i) && matchPerson(trimmed, context.people);
  if (decline) return done({ template: "change_preview", change: { kind: "decline_viewing", personKey: decline.key } });

  // A person the lister named: handled here, the name is never sent anywhere.
  const person = matchPerson(trimmed, context.people);
  if (person) {
    if (/\b(?:times?|slots?|propose|suggest)\b/i.test(trimmed)) return done({ template: "viewing_slots", personKey: person.key });
    return done({ template: "person_detail", personKey: person.key });
  }

  if (/\b(?:what needs|needs my attention|attention|today|to ?do|what'?s (?:new|waiting|up))\b/i.test(trimmed) && !/\b(?:enquir|applica|people|leads)\w*\b/i.test(trimmed)) {
    return done({ template: "today" });
  }
  if (/\b(?:what (?:do )?people ask|questions?|asking about|ask(?:ed)? about|what are people asking)\b/i.test(trimmed)) return done({ template: "question_insights", ...(listingId ? { listingId } : {}) });
  if (/\b(?:help me (?:list|create|write)|create (?:a )?(?:new )?listing|new listing|list (?:a|my|an)\b|post (?:a|my) (?:room|flat|house|apartment|listing))/i.test(trimmed)) {
    const parsed = parseSearchText(trimmed);
    const draft: NewListingDraft = { notes: trimmed.slice(0, 1000) };
    for (const chip of parsed.chips) {
      if (chip.kind === "type") draft.propertyType ??= chip.value;
      if (chip.kind === "beds") draft.bedrooms = chip.value;
      if (chip.kind === "baths") draft.bathrooms = chip.value;
      if (chip.kind === "maxPrice") draft.price = chip.value;
      if (chip.kind === "near") draft.area = chip.value;
      if (chip.kind === "mode") draft.listingType = "sale";
    }
    return done({ template: "new_listing", draft });
  }
  // "Rewrite the description of my Bellville room": one named listing gets a suggested description.
  if (/\b(?:rewrite|improve|better|write)\b.*\bdescription\b|\bdescription\b.*\b(?:rewrite|improve|better)\b/i.test(trimmed)) {
    return done(listingId ? { template: "improve_listing", listingId } : { template: "quality_check" });
  }
  if (/\b(?:what'?s missing|check (?:my )?listings?|quality|improve (?:my )?listings?|fix (?:my )?listings?)\b/i.test(trimmed)) return done({ template: "quality_check", ...(listingId ? { listingId } : {}) });
  if (/\b(?:how (?:are|is) (?:my )?listings?|performance|doing|stats|views|funnel|how many views)\b/i.test(trimmed)) return done({ template: "performance", ...(listingId ? { listingId } : {}) });
  if (/\b(?:viewing (?:times|slots)|propose times|free slots)\b/i.test(trimmed)) return done({ template: "viewing_slots" });

  // People questions: "who's serious", "waiting on me", "everyone interested in rooms under R4,000".
  const peopleWords = /\b(?:enquir\w*|people|leads?|interested|serious|waiting on me|waiting for me|who|applicants?|applications?|customers?|renters?|buyers?|gone quiet)\b/i;
  if (peopleWords.test(trimmed)) {
    const filters: PeopleFilters = {};
    if (/\bwaiting (?:on|for) me\b|\bwho needs? (?:a )?reply\b|\bunanswered\b/i.test(trimmed)) filters.waitingOnYou = true;
    const when = since(trimmed);
    if (when) filters.since = when;
    const found = stage(trimmed);
    if (found) filters.stage = found;
    const prices = parseSearchText(trimmed).chips;
    for (const chip of prices) {
      if (chip.kind === "maxPrice") filters.maxPrice = chip.value;
      if (chip.kind === "minPrice") filters.minPrice = chip.value;
    }
    if (listingId) filters.subjectId = listingId;
    return done({ template: "people_list", filters });
  }

  return { request: null, source: "rules", textForAi: maskNames(trimmed, context.people) };
}
