import { z } from "zod";

import { listingTypes, propertyTypes } from "@/features/listings/schema";

import { AMENITY_KEYS } from "./listing-writer";

/**
 * Carries the assistant's new-listing suggestion to the quick draft form (proposal, "Listing
 * creation assistant": a preview then goes through the existing publish flow). It lives in
 * this tab's session storage, never in the address, is cleared once a draft is created or the
 * lister starts blank, and expires after an hour.
 * Nothing is saved until the lister taps "Create private draft" in the form.
 */

export const LISTING_HANDOFF_KEY = "pinpoint:assistant-listing";
const MAX_AGE_MS = 60 * 60_000;

const handoffSchema = z.object({
  savedAt: z.number(),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000),
  // A type the form doesn't offer drops just that field, not the whole suggestion.
  propertyType: z.string().nullable().transform((value) => ((propertyTypes as readonly string[]).includes(value ?? "") ? (value as (typeof propertyTypes)[number]) : null)),
  listingType: z.enum(listingTypes),
  price: z.number().int().positive().max(100_000_000).nullable(),
  features: z.array(z.string()).max(30).transform((keys) => [...new Set(keys)].filter((key) => AMENITY_KEYS.includes(key))),
});

export type ListingHandoff = z.infer<typeof handoffSchema>;

export function saveListingHandoff(handoff: Omit<z.input<typeof handoffSchema>, "savedAt">, storage: Pick<Storage, "setItem"> = window.sessionStorage, now = Date.now()) {
  try {
    storage.setItem(LISTING_HANDOFF_KEY, JSON.stringify({ ...handoff, savedAt: now }));
  } catch {
    // Private mode or a full store: the form simply opens empty.
  }
}

/** Reads a stored suggestion without removing it. Expired or malformed ones read as none. */
export function parseListingHandoff(raw: string | null, now = Date.now()): ListingHandoff | null {
  if (!raw) return null;
  try {
    const parsed = handoffSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || now - parsed.data.savedAt > MAX_AGE_MS || parsed.data.savedAt > now + 60_000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function readStoredHandoff(storage: Pick<Storage, "getItem"> = window.sessionStorage): string | null {
  try {
    return storage.getItem(LISTING_HANDOFF_KEY);
  } catch {
    return null;
  }
}

export function clearListingHandoff(storage: Pick<Storage, "removeItem"> = window.sessionStorage) {
  try {
    storage.removeItem(LISTING_HANDOFF_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Reads the suggestion once and removes it. */
export function takeListingHandoff(storage: Pick<Storage, "getItem" | "removeItem"> = window.sessionStorage, now = Date.now()): ListingHandoff | null {
  const raw = readStoredHandoff(storage);
  clearListingHandoff(storage);
  return parseListingHandoff(raw, now);
}
