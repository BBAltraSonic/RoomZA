import { z } from "zod";

import { IMPORT_LIMITS } from "./limits";
import type {
  CanonicalImportListing,
  ImportIssueCode,
  ImportIssueSeverity,
  ImportMapping,
  ParsedRecord,
} from "./types";

export type NormalizationIssue = {
  severity: ImportIssueSeverity;
  code: ImportIssueCode;
  field?: keyof CanonicalImportListing;
  message: string;
};

const emailSchema = z.string().email();
const enumValues = {
  listingType: ["rent", "sale"],
  propertyType: ["apartment", "house", "room", "studio", "cottage", "townhouse"],
} as const;

const unsafeKeys = new Set(["__proto__", "prototype", "constructor"]);

export function assertSafeRecord(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeRecord(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (unsafeKeys.has(key)) throw new Error(`Unsafe JSON key at ${path}.${key}`);
    assertSafeRecord(child, `${path}.${key}`);
  }
}

export function normalizeText(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const text = String(value).replaceAll("\u0000", "").trim();
  return text || undefined;
}

export function normalizeMoney(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : undefined;
  const text = normalizeText(value);
  if (!text) return undefined;
  const negative = /^\s*\(.*\)\s*$/.test(text);
  const numeric = Number(text.replaceAll(/[^\d,.-]/g, "").replaceAll(",", ""));
  if (!Number.isFinite(numeric)) return undefined;
  return Math.round(negative ? -Math.abs(numeric) : numeric);
}

export function normalizeNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const text = normalizeText(value);
  if (!text) return undefined;
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  const text = normalizeText(value)?.toLowerCase();
  if (["true", "yes", "y", "1"].includes(text ?? "")) return true;
  if (["false", "no", "n", "0"].includes(text ?? "")) return false;
  return undefined;
}

export function normalizeList(value: unknown) {
  if (Array.isArray(value)) return [...new Set(value.map(normalizeText).filter(Boolean) as string[])];
  const text = normalizeText(value);
  if (!text) return undefined;
  return [...new Set(text.split(/[;,|]/).map((item) => item.trim()).filter(Boolean))];
}

export function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  const text = normalizeText(value);
  if (!text) return undefined;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  if (iso && !Number.isNaN(Date.parse(`${iso}T00:00:00Z`))) return iso;
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return undefined;
  const date = new Date(parsed);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeSouthAfricanPhone(value: unknown) {
  const text = normalizeText(value);
  if (!text) return undefined;
  const compact = text.replaceAll(/[^\d+]/g, "");
  if (/^0\d{9}$/.test(compact)) return `+27${compact.slice(1)}`;
  if (/^\+27\d{9}$/.test(compact)) return compact;
  if (/^27\d{9}$/.test(compact)) return `+${compact}`;
  return undefined;
}

export function normalizeEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  dictionary: Record<string, T> = {},
) {
  const text = normalizeText(value)?.toLowerCase();
  if (!text) return undefined;
  const remapped = dictionary[text] ?? text;
  return allowed.includes(remapped as T) ? (remapped as T) : undefined;
}

export function mapRecord(
  record: ParsedRecord,
  mapping: ImportMapping,
  defaults: Partial<CanonicalImportListing> = {},
  dictionaries: Partial<Record<keyof CanonicalImportListing, Record<string, string>>> = {},
) {
  const output: Record<string, unknown> = { ...defaults };
  for (const [sourceField, targetField] of Object.entries(mapping)) {
    if (targetField) output[targetField] = record.raw[sourceField];
  }

  const listing: CanonicalImportListing = {
    ...defaults,
    sourceReference: normalizeText(output.sourceReference),
    title: normalizeText(output.title),
    description: normalizeText(output.description),
    listingType: normalizeEnum(
      output.listingType,
      enumValues.listingType,
      dictionaries.listingType as Record<string, "rent" | "sale"> | undefined,
    ),
    propertyType: normalizeEnum(
      output.propertyType,
      enumValues.propertyType,
      dictionaries.propertyType as Record<string, "apartment" | "house" | "room" | "studio" | "cottage" | "townhouse"> | undefined,
    ),
    price: normalizeMoney(output.price),
    salePrice: normalizeMoney(output.salePrice),
    address: normalizeText(output.address),
    latitude: normalizeNumber(output.latitude),
    longitude: normalizeNumber(output.longitude),
    bedrooms: normalizeNumber(output.bedrooms),
    bathrooms: normalizeNumber(output.bathrooms),
    parkingType: normalizeText(output.parkingType),
    parkingCount: normalizeNumber(output.parkingCount),
    electricityType: normalizeText(output.electricityType),
    waterAvailability: normalizeText(output.waterAvailability),
    leaseDuration: normalizeText(output.leaseDuration),
    availabilityDate: normalizeDate(output.availabilityDate),
    contactEmail: normalizeText(output.contactEmail)?.toLowerCase(),
    contactPhone: normalizeSouthAfricanPhone(output.contactPhone),
    amenities: normalizeList(output.amenities),
    imageReferences: normalizeList(output.imageReferences),
    responsibleAgentId: normalizeText(output.responsibleAgentId),
    officeId: normalizeText(output.officeId),
    isFeatured: normalizeBoolean(output.isFeatured),
    publicationSelected: normalizeBoolean(output.publicationSelected),
  };

  return Object.fromEntries(Object.entries(listing).filter(([, value]) => value !== undefined)) as CanonicalImportListing;
}

export function addressFingerprint(value: string | undefined) {
  if (!value) return undefined;
  return value
    .normalize("NFKD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(/\b(street|st|road|rd|avenue|ave|drive|dr)\b/g, "")
    .replaceAll(/[^a-z0-9]/g, "");
}

export function validateCanonicalListing(listing: CanonicalImportListing): NormalizationIssue[] {
  const issues: NormalizationIssue[] = [];
  if (!listing.title) issues.push({ severity: "blocking", code: "missing_title", field: "title", message: "Add a listing title." });
  if (!listing.address) issues.push({ severity: "blocking", code: "missing_address", field: "address", message: "Add a property address." });

  const price = listing.listingType === "sale" ? listing.salePrice : listing.price;
  if (!price || price <= 0) {
    issues.push({ severity: "blocking", code: "invalid_price", field: listing.listingType === "sale" ? "salePrice" : "price", message: "Enter a price greater than zero." });
  }
  if (listing.contactEmail && !emailSchema.safeParse(listing.contactEmail).success) {
    issues.push({ severity: "warning", code: "invalid_email", field: "contactEmail", message: "Use a valid contact email." });
  }
  if (listing.contactPhone && !/^\+27\d{9}$/.test(listing.contactPhone)) {
    issues.push({ severity: "warning", code: "invalid_phone", field: "contactPhone", message: "Use a valid South African phone number." });
  }
  const coordinatePair = listing.latitude !== undefined || listing.longitude !== undefined;
  if (coordinatePair && (
    listing.latitude === undefined || listing.longitude === undefined
    || listing.latitude < -90 || listing.latitude > 90
    || listing.longitude < -180 || listing.longitude > 180
  )) {
    issues.push({ severity: "publish_blocker", code: "invalid_coordinates", field: "latitude", message: "Provide both valid latitude and longitude values." });
  }
  if (!coordinatePair) {
    issues.push({ severity: "publish_blocker", code: "ambiguous_geocode", field: "address", message: "Confirm the mapped location before publishing." });
  }
  if (!listing.propertyType) issues.push({ severity: "publish_blocker", code: "invalid_enum", field: "propertyType", message: "Choose a supported property type." });
  if (!listing.availabilityDate) issues.push({ severity: "publish_blocker", code: "invalid_date", field: "availabilityDate", message: "Add a valid availability date." });
  if ((listing.imageReferences?.length ?? 0) > IMPORT_LIMITS.imagesPerListing) {
    issues.push({ severity: "publish_blocker", code: "too_many_images", field: "imageReferences", message: `Keep at most ${IMPORT_LIMITS.imagesPerListing} images.` });
  }
  if ((listing.imageReferences?.length ?? 0) < 3) {
    issues.push({ severity: "publish_blocker", code: "missing_images", field: "imageReferences", message: "Add at least three images before publishing." });
  }
  if (!listing.responsibleAgentId) {
    issues.push({ severity: "blocking", code: "responsible_agent_required", field: "responsibleAgentId", message: "Assign an active organization member." });
  }
  return issues;
}

export function rowStateForIssues(issues: NormalizationIssue[]) {
  if (issues.some((issue) => issue.severity === "blocking")) return "parse_blocked" as const;
  if (issues.some((issue) => issue.severity === "publish_blocker")) return "publish_blocked" as const;
  if (issues.length) return "warning" as const;
  return "draft_ready" as const;
}
