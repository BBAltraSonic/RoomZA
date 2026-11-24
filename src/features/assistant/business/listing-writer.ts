import { amenityCategories, amenityLabels, propertyTypes } from "@/features/listings/schema";

import { stripContactDetails } from "../privacy";

/**
 * AI job 3's checks and its no-AI fallback: listing writing (proposal, capability 3).
 * The AI reads only the listing's public details and what the lister typed. Pinpoint checks
 * its answer: features must be Pinpoint's own amenity keys, the type one of Pinpoint's types,
 * and every number in the title or description must be one the lister gave. Anything else
 * is dropped and the rules-built version is used.
 */

export const AMENITY_KEYS = Object.values(amenityCategories).flatMap((category) => [...category.items]) as string[];

export type ListingWritingInput = {
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  price?: number;
  listingType?: "rent" | "sale";
  area?: string;
  /** What the lister typed about the place, contact details removed. */
  notes: string;
};

export type ListingWriting = { title: string; description: string; features: string[]; propertyType: string | null };

const TYPE_WORDS: Record<string, string> = { apartment: "apartment", house: "house", room: "room", studio: "studio", cottage: "cottage", townhouse: "townhouse" };

function rand(value: number) {
  return `R${Math.round(value).toLocaleString("en-US")}`;
}

/** Feature chips the rules can find in what was typed. */
export function featuresFromNotes(notes: string): string[] {
  const text = notes.toLocaleLowerCase("en-ZA");
  const patterns: Record<string, RegExp> = {
    wifi: /\b(?:wi-?fi|fibre|fiber|internet)\b/,
    furnished: /\bfurnished\b/,
    pet_friendly: /\bpet[- ]?friendly|pets (?:allowed|welcome)\b/,
    backup_power: /\b(?:inverter|generator|backup power|solar power)\b/,
    solar_geyser: /\bsolar geyser\b/,
    secure_parking: /\b(?:secure|covered) parking\b/,
    gated_complex: /\bgated\b/,
    "24hr_security": /\b24 ?(?:hr|hour) security\b/,
    cctv: /\bcctv\b/,
    garden: /\bgarden\b/,
    balcony: /\bbalcony\b/,
    pool: /\bpool\b/,
    braai_area: /\bbraai\b/,
    laundry: /\blaundry\b/,
    washing_machine: /\bwashing machine\b/,
  };
  return Object.entries(patterns).filter(([, pattern]) => pattern.test(text)).map(([key]) => key);
}

export type WritableListing = {
  title: string;
  description: string | null;
  property_type: string | null;
  listing_type?: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price: number | null;
  sale_price?: number | null;
  metadata: { amenities?: Partial<Record<string, readonly string[]>> } | null;
};

/**
 * The writing job's input for an existing listing: its public fields, title, current
 * description and features, with any contact details removed. Never the lister's private data.
 */
export function writingInputFromListing(listing: WritableListing): ListingWritingInput {
  const sale = listing.listing_type === "sale";
  const features = Object.values(listing.metadata?.amenities ?? {}).flatMap((keys) => [...(keys ?? [])]).map((key) => amenityLabels[key] ?? key);
  const notes = [listing.title, listing.description?.trim() ?? "", features.length ? `Features: ${features.join(", ")}` : ""].filter(Boolean).join(". ");
  const price = sale ? listing.sale_price ?? listing.price : listing.price;
  return {
    ...(listing.property_type ? { propertyType: listing.property_type } : {}),
    ...(listing.bedrooms ? { bedrooms: listing.bedrooms } : {}),
    ...(listing.bathrooms ? { bathrooms: listing.bathrooms } : {}),
    ...(price ? { price } : {}),
    listingType: sale ? "sale" : "rent",
    notes: stripContactDetails(notes).slice(0, 1000),
  };
}

/** The no-AI version: a plain title and description from the fields alone. */
export function writeListingByRules(input: ListingWritingInput): ListingWriting {
  const type = input.propertyType && TYPE_WORDS[input.propertyType] ? input.propertyType : null;
  const typeWord = type ?? "place";
  const beds = input.bedrooms ? `${input.bedrooms}-bedroom ` : "";
  const title = `${beds}${typeWord}${input.area ? ` in ${input.area}` : ""}`.replace(/^./, (letter) => letter.toUpperCase()).slice(0, 100);
  const features = featuresFromNotes(input.notes);
  const parts = [
    `${beds ? `A ${beds}` : "A "}${typeWord}${input.area ? ` in ${input.area}` : ""}${input.listingType === "sale" ? " for sale" : " to rent"}.`,
    input.bathrooms ? `${input.bathrooms} bathroom${input.bathrooms === 1 ? "" : "s"}.` : "",
    input.price ? `${rand(input.price)}${input.listingType === "sale" ? "" : " a month"}.` : "",
    features.length ? `Features: ${features.map((key) => amenityLabels[key] ?? key).join(", ")}.` : "",
  ];
  return { title, description: parts.filter(Boolean).join(" "), features, propertyType: type };
}

/**
 * Numbers as a reader sees them: "14 500" and "14,500" are one number (thousands groups of
 * exactly three digits), but "3 2" is two. Grouping is stripped so "R14,500" matches 14500.
 */
export function numbersIn(text: string) {
  return (text.match(/\d{1,3}(?:[ ,]\d{3})+(?!\d)|\d+(?:\.\d+)?/g) ?? []).map((value) => value.replace(/[ ,]/g, ""));
}

/** Pinpoint's check of the AI's writing. Returns null when it can't be trusted. */
export function checkAiWriting(candidate: { title: string; description: string; features: string[]; propertyType: string | null }, input: ListingWritingInput): ListingWriting | null {
  const title = candidate.title.trim().slice(0, 100);
  const description = candidate.description.trim().slice(0, 2000);
  if (title.length < 5 || description.length < 20) return null;
  // Built per value: joining the fields into one string would let "14500 3 2" read as one number.
  const given = new Set(numbersIn(input.notes));
  for (const value of [input.price, input.bedrooms, input.bathrooms]) {
    if (value === undefined) continue;
    given.add(String(value));
    given.add(String(Math.round(value)));
  }
  // A number the lister never gave (a price, size or distance) is an invented fact.
  if ([...numbersIn(title), ...numbersIn(description)].some((number) => !given.has(number))) return null;
  const features = [...new Set(candidate.features)].filter((key) => AMENITY_KEYS.includes(key));
  const propertyType = candidate.propertyType && (propertyTypes as readonly string[]).includes(candidate.propertyType) ? candidate.propertyType : null;
  return { title, description, features, propertyType };
}
