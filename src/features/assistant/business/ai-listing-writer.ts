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

export async function writeListing(input: ListingWritingInput, config: AssistantAiConfig | null): Promise<WritingOutcome> {
  const rules = writeListingByRules(input);
  if (!config) return { writing: rules, source: "rules" };
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
  if (!outcome.ok) return { writing: rules, source: "rules" };
  const checked = checkAiWriting(outcome.result, input);
  if (!checked) return { writing: rules, source: "rules" };
  return { writing: { ...checked, features: [...new Set([...checked.features, ...rules.features])], propertyType: checked.propertyType ?? rules.propertyType }, source: "ai" };
}
