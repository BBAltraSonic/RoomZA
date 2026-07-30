import type { CanonicalImportListing } from "./types";

export type CanonicalFieldDefinition = {
  key: keyof CanonicalImportListing;
  label: string;
  group: "identity" | "property" | "pricing" | "location" | "operations" | "media";
  aliases: string[];
  draftRequired?: boolean;
  publishRequired?: boolean;
};

export const CANONICAL_IMPORT_FIELDS: CanonicalFieldDefinition[] = [
  { key: "sourceReference", label: "Source reference", group: "identity", aliases: ["reference", "ref", "external id", "property id", "listing id"] },
  { key: "title", label: "Listing title", group: "identity", aliases: ["name", "headline", "property name"], draftRequired: true },
  { key: "description", label: "Description", group: "identity", aliases: ["details", "body", "marketing description"], publishRequired: true },
  { key: "listingType", label: "Listing type", group: "property", aliases: ["rent or sale", "transaction type", "mandate type"], draftRequired: true },
  { key: "propertyType", label: "Property type", group: "property", aliases: ["type", "category"], publishRequired: true },
  { key: "price", label: "Monthly rent", group: "pricing", aliases: ["rent", "rental", "monthly price", "price"], draftRequired: true },
  { key: "salePrice", label: "Sale price", group: "pricing", aliases: ["purchase price", "asking price"] },
  { key: "address", label: "Street address", group: "location", aliases: ["location", "full address", "property address"], draftRequired: true },
  { key: "latitude", label: "Latitude", group: "location", aliases: ["lat"] },
  { key: "longitude", label: "Longitude", group: "location", aliases: ["lng", "lon", "long"] },
  { key: "bedrooms", label: "Bedrooms", group: "property", aliases: ["beds", "bedroom count"], publishRequired: true },
  { key: "bathrooms", label: "Bathrooms", group: "property", aliases: ["baths", "bathroom count"], publishRequired: true },
  { key: "parkingType", label: "Parking type", group: "property", aliases: ["parking"] },
  { key: "parkingCount", label: "Parking spaces", group: "property", aliases: ["parking bays", "garages"] },
  { key: "electricityType", label: "Electricity", group: "operations", aliases: ["electricity type", "power"] },
  { key: "waterAvailability", label: "Water", group: "operations", aliases: ["water availability", "water"] },
  { key: "leaseDuration", label: "Lease duration", group: "operations", aliases: ["lease", "term"] },
  { key: "availabilityDate", label: "Available from", group: "operations", aliases: ["available", "move in", "occupation date"], publishRequired: true },
  { key: "contactEmail", label: "Contact email", group: "operations", aliases: ["agent email", "email"] },
  { key: "contactPhone", label: "Contact phone", group: "operations", aliases: ["agent phone", "phone", "mobile"] },
  { key: "amenities", label: "Amenities", group: "property", aliases: ["features", "facilities"] },
  { key: "imageReferences", label: "Images", group: "media", aliases: ["photos", "image urls", "image filenames"] },
  { key: "responsibleAgentId", label: "Responsible agent", group: "operations", aliases: ["agent id", "landlord id"] },
  { key: "officeId", label: "Office", group: "operations", aliases: ["office id", "branch"] },
  { key: "isFeatured", label: "Featured", group: "operations", aliases: ["feature", "promoted"] },
  { key: "publicationSelected", label: "Publish after review", group: "operations", aliases: ["publish", "go live"] },
];

function normalizeHeader(value: string) {
  return value.trim().toLocaleLowerCase().replaceAll(/[_-]+/g, " ").replaceAll(/\s+/g, " ");
}

export function suggestFieldForHeader(header: string): keyof CanonicalImportListing | null {
  const normalized = normalizeHeader(header);
  let best: { key: keyof CanonicalImportListing; score: number } | null = null;

  for (const field of CANONICAL_IMPORT_FIELDS) {
    const candidates = [field.label, field.key, ...field.aliases].map(normalizeHeader);
    const exact = candidates.includes(normalized);
    const partial = candidates.some((candidate) => candidate.includes(normalized) || normalized.includes(candidate));
    const score = exact ? 2 : partial && normalized.length >= 3 ? 1 : 0;
    if (score > (best?.score ?? 0)) best = { key: field.key, score };
  }

  return best?.key ?? null;
}

export function suggestMapping(headers: string[]) {
  return Object.fromEntries(headers.map((header) => [header, suggestFieldForHeader(header)]));
}
