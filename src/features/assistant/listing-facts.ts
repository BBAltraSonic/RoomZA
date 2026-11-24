import { amenityLabels } from "@/features/listings/schema";

/**
 * Listing facts (proposal, template "Listing fact"). One answer to a question about the open
 * listing, read from the listing's own fields. No AI: a fixed list of topics is matched by
 * rules, and anything the listing doesn't state goes to "Ask landlord". A missing field is
 * never read as "no".
 */

export const FACT_TOPICS = [
  "parking",
  "pets",
  "wifi",
  "deposit",
  "electricity",
  "water",
  "furnished",
  "move-in",
  "lease",
  "security",
  "backup-power",
  "laundry",
  "fees",
  "bedrooms",
  "bathrooms",
  "price",
] as const;
export type FactTopic = (typeof FACT_TOPICS)[number];

export type FactListing = {
  id: string;
  title: string;
  listing_type?: "rent" | "sale";
  price: number;
  display_price?: number | null;
  bedrooms: number;
  bathrooms: number;
  parking_type: string;
  parking_count: number;
  parking_included?: boolean | null;
  parking_estimate?: number | null;
  electricity_type: string;
  electricity_included?: boolean | null;
  electricity_estimate?: number | null;
  water_availability: string;
  water_included?: boolean | null;
  water_estimate?: number | null;
  wifi_available?: boolean | null;
  wifi_included?: boolean | null;
  wifi_estimate?: number | null;
  deposit_amount?: number | null;
  deposit_online?: boolean;
  admin_fee?: number | null;
  lease_duration: string;
  availability_date: string | null;
  metadata: { amenities?: Partial<Record<string, readonly string[]>> } | null;
};

export type FactAnswer = { known: true; answer: string } | { known: false };

/** Most specific patterns first: "load shedding" before "electricity", "garage" before nothing. */
const TOPIC_PATTERNS: [FactTopic, RegExp][] = [
  ["backup-power", /\b(?:load[- ]?shedding|backup power|generator|inverter|solar|power cuts?|outages?)\b/i],
  ["parking", /\b(?:parking|park|garage|carport|car)\b/i],
  ["pets", /\b(?:pets?|dogs?|cats?|animals?)\b/i],
  ["wifi", /\b(?:wi-?fi|internet|fibre|fiber)\b/i],
  ["deposit", /\bdeposit\b/i],
  ["fees", /\b(?:admin(?:istration)? fees?|fees?|extra costs?|move-in costs?|hidden costs?)\b/i],
  ["electricity", /\b(?:electricity|lights|power|prepaid|eskom)\b/i],
  ["water", /\bwater\b/i],
  ["furnished", /\b(?:furnished|furniture|bed and|desk)\b/i],
  ["move-in", /\b(?:move[- ]?in|moving in|available|availability|when can i|start date)\b/i],
  ["lease", /\b(?:lease|contract|month[- ]to[- ]month|how long)\b/i],
  ["security", /\b(?:security|safe|secure|cctv|guard|gated|alarm)\b/i],
  ["laundry", /\b(?:laundry|washing machine|washer|tumble dryer)\b/i],
  ["bedrooms", /\b(?:bedrooms?|beds?)\b/i],
  ["bathrooms", /\b(?:bathrooms?|baths?|showers?|toilets?)\b/i],
  ["price", /\b(?:rent|price|cost|how much|monthly)\b/i],
];

export function matchFactTopic(text: string): FactTopic | null {
  for (const [topic, pattern] of TOPIC_PATTERNS) if (pattern.test(text)) return topic;
  return null;
}

const QUESTION_START = /^\s*(?:does|do|is|are|can|could|will|would|has|have|how|what|what's|whats|when|where|which|who|any)\b/i;

/** A question about the open listing, rather than a new search. */
export function isListingQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return trimmed.endsWith("?") || (QUESTION_START.test(trimmed) && matchFactTopic(trimmed) !== null);
}

function rand(value: number) {
  return `R${Math.round(value).toLocaleString("en-US")}`;
}

function amenities(listing: FactListing): string[] {
  const groups = listing.metadata?.amenities;
  if (!groups) return [];
  return Object.values(groups).flatMap((items) => (Array.isArray(items) ? (items as string[]) : []));
}

function listed(listing: FactListing, keys: readonly string[]) {
  const have = new Set(amenities(listing));
  return keys.filter((key) => have.has(key)).map((key) => amenityLabels[key] ?? key);
}

const PARKING_TYPES: Record<string, string> = { covered: "covered", uncovered: "uncovered", garage: "garage" };
const ELECTRICITY_TYPES: Record<string, string> = { prepaid: "Prepaid", conventional: "Conventional", solar: "Solar" };
const WATER_TYPES: Record<string, string> = { municipal: "Municipal", borehole: "Borehole", both: "Municipal and borehole" };
const LEASES: Record<string, string> = { month_to_month: "month to month", "6_months": "6 months", "12_months": "12 months", "24_months": "24 months" };

function utility(name: string, included: boolean | null | undefined, estimate: number | null | undefined, rent: boolean) {
  if (included) return `${name}, included in the ${rent ? "rent" : "price"}.`;
  if (included === false) return estimate ? `${name}, not included: about ${rand(estimate)} a month.` : `${name}, not included.`;
  return `${name}.`;
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function answerListingFact(listing: FactListing, topic: FactTopic, now = new Date()): FactAnswer {
  const rent = listing.listing_type !== "sale";
  const known = (answer: string): FactAnswer => ({ known: true, answer });
  const unknown: FactAnswer = { known: false };
  switch (topic) {
    case "parking": {
      if (listing.parking_type === "none" || listing.parking_count <= 0) return known("No parking is listed for this place.");
      const kind = PARKING_TYPES[listing.parking_type] ?? "";
      const bays = `${listing.parking_count} ${kind ? `${kind} ` : ""}parking bay${listing.parking_count === 1 ? "" : "s"}`;
      if (listing.parking_included) return known(`Yes: ${bays}, included in the ${rent ? "rent" : "price"}.`);
      if (listing.parking_estimate) return known(`Yes: ${bays}, about ${rand(listing.parking_estimate)} a month extra.`);
      return known(`Yes: ${bays}.`);
    }
    case "pets":
      return listed(listing, ["pet_friendly"]).length ? known("Yes, the listing says it's pet friendly.") : unknown;
    case "wifi":
      if (listing.wifi_available === false) return known("The listing says there's no Wi-Fi.");
      if (!listing.wifi_available) return unknown;
      if (listing.wifi_included) return known(`Wi-Fi is included in the ${rent ? "rent" : "price"}.`);
      return known(listing.wifi_estimate ? `Wi-Fi is available, about ${rand(listing.wifi_estimate)} a month extra.` : "Wi-Fi is available.");
    case "deposit":
      if (!listing.deposit_amount) return unknown;
      return known(
        `The deposit is ${rand(listing.deposit_amount)}.${listing.deposit_online ? " Approved renters can pay it through Pinpoint, which holds it until move-in." : ""}`,
      );
    case "fees":
      return listing.admin_fee ? known(`Admin fee: ${rand(listing.admin_fee)}.`) : unknown;
    case "electricity": {
      const type = ELECTRICITY_TYPES[listing.electricity_type];
      if (listing.electricity_type === "none") return known("The listing says there's no electricity supply.");
      return type ? known(utility(`${type} electricity`, listing.electricity_included, listing.electricity_estimate, rent)) : unknown;
    }
    case "water": {
      const type = WATER_TYPES[listing.water_availability];
      if (listing.water_availability === "none") return known("The listing says there's no water supply.");
      return type ? known(utility(`${type} water`, listing.water_included, listing.water_estimate, rent)) : unknown;
    }
    case "furnished":
      return listed(listing, ["furnished"]).length ? known("Yes, it's furnished.") : unknown;
    case "move-in": {
      if (!listing.availability_date) return unknown;
      const available = Date.parse(`${listing.availability_date.slice(0, 10)}T00:00:00+02:00`);
      if (!Number.isFinite(available)) return unknown;
      return known(available <= now.getTime() ? "Available now." : `Available from ${formatDate(listing.availability_date)}.`);
    }
    case "lease": {
      const lease = LEASES[listing.lease_duration];
      return rent && lease ? known(`The lease is ${lease}.`) : unknown;
    }
    case "security": {
      const items = listed(listing, ["24hr_security", "cctv", "electric_fencing", "alarm_system", "secure_parking", "gated_complex", "intercom"]);
      return items.length ? known(`Listed security: ${items.join(", ")}.`) : unknown;
    }
    case "backup-power": {
      const items = listed(listing, ["backup_power", "solar_geyser"]);
      return items.length ? known(`Listed: ${items.join(", ")}.`) : unknown;
    }
    case "laundry": {
      const items = listed(listing, ["laundry", "washing_machine", "tumble_dryer"]);
      return items.length ? known(`Listed: ${items.join(", ")}.`) : unknown;
    }
    case "bedrooms":
      return known(`${listing.bedrooms} bedroom${listing.bedrooms === 1 ? "" : "s"}.`);
    case "bathrooms":
      return known(`${listing.bathrooms} bathroom${listing.bathrooms === 1 ? "" : "s"}.`);
    case "price": {
      const price = listing.display_price ?? listing.price;
      if (!price) return unknown;
      return known(rent ? `${rand(price)} a month.` : `${rand(price)}.`);
    }
  }
}
