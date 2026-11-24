import "server-only";

import { z } from "zod";

import { propertyTypes } from "@/features/listings/schema";

import { askStructured, type AssistantAiConfig } from "../openrouter";
import { AMENITY_KEYS, checkAiWriting, writeListingByRules, type ListingWriting, type ListingWritingInput } from "./listing-writer";

/** AI job 3: listing writing. Public listing details and the lister's own words only. */

const schema = z.object({
  title: z.string().max(140),
  description: z.string().max(2400),
  features: z.array(z.string()).max(20),
  propertyType: z.string().nullable(),
});

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "features", "propertyType"],
  properties: {
    title: { type: "string", description: "Under 80 characters" },
    description: { type: "string", description: "2 to 4 short, plain sentences" },
    features: { type: "array", items: { type: "string", enum: AMENITY_KEYS } },
    propertyType: { type: ["string", "null"], enum: [...propertyTypes, null] },
  },
} as const;

const SYSTEM_PROMPT = [
  "You help a South African landlord or seller write a listing for Pinpoint.",
  "Reply with JSON only. Write in plain, friendly English.",
  "Use only facts the lister gave. Never add prices, sizes, distances, rules, photos or features they didn't mention.",
  "Never include phone numbers, email addresses or names.",
  "features lists only amenities the lister mentioned, using the allowed keys.",
].join("\n");

export type WritingOutcome = { writing: ListingWriting; source: "ai" | "rules" };

export type AiWritingOutcome = { ok: true; writing: ListingWriting; model: string } | { ok: false; reason: "unavailable" | "rejected" };

/** The AI's writing after Pinpoint's checks, or why there is none. */
export async function writeListingWithAi(input: ListingWritingInput, config: AssistantAiConfig): Promise<AiWritingOutcome> {
  const rules = writeListingByRules(input);
  const details = [
    input.listingType ? `For: ${input.listingType === "sale" ? "sale" : "rent"}` : "",
    input.propertyType ? `Type: ${input.propertyType}` : "",
    input.bedrooms ? `Bedrooms: ${input.bedrooms}` : "",
    input.bathrooms ? `Bathrooms: ${input.bathrooms}` : "",
    input.price ? `Price: R${input.price}` : "",
    input.area ? `Area: ${input.area}` : "",
    `What the lister wrote: ${input.notes}`,
  ].filter(Boolean).join("\n");
  const outcome = await askStructured({ system: SYSTEM_PROMPT, user: details, name: "listing_writing", jsonSchema: JSON_SCHEMA, schema, maxTokens: 500, temperature: 0.3 }, config);
  if (!outcome.ok) return { ok: false, reason: "unavailable" };
  const checked = checkAiWriting(outcome.result, input);
  if (!checked) return { ok: false, reason: "rejected" };
  return { ok: true, model: outcome.model, writing: { ...checked, features: [...new Set([...checked.features, ...rules.features])], propertyType: checked.propertyType ?? rules.propertyType } };
}

export async function writeListing(input: ListingWritingInput, config: AssistantAiConfig | null): Promise<WritingOutcome> {
  if (!config) return { writing: writeListingByRules(input), source: "rules" };
  const outcome = await writeListingWithAi(input, config);
  return outcome.ok ? { writing: outcome.writing, source: "ai" } : { writing: writeListingByRules(input), source: "rules" };
}
