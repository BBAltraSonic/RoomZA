import "server-only";

import { z } from "zod";

import { askStructured, type AssistantAiConfig } from "./openrouter";

import {
  FLAG_VALUES,
  GAP_LABELS,
  mergeChips,
  parseSearchText,
  PROPERTY_TYPE_VALUES,
  type SearchChip,
  type SearchGap,
} from "./search-intent";

/**
 * AI job 1: customer search text -> filters (proposal, "Where AI is used").
 *
 * The AI receives only the words just typed (contact details already stripped) and the
 * labels of the current chips. No account ID, name or memory is ever attached. It returns
 * a short structured answer; Pinpoint checks every field before it becomes a chip.
 */


const AI_QUICK_VALUES = ["furnished", "nsfas-approved", "recently-listed"] as const;
const AI_FLAG_VALUES = FLAG_VALUES.filter((flag) => flag !== "repliesUnder5");
const AI_GAP_VALUES = ["pets", "wifi", "parking", "move-in", "unfurnished", "security", "distance", "other"] as const;

export const aiSearchResultSchema = z.object({
  english: z.boolean(),
  mode: z.enum(["rent", "buy", "unchanged"]),
  minPrice: z.number().nullable(),
  maxPrice: z.number().nullable(),
  beds: z.number().nullable(),
  baths: z.number().nullable(),
  propertyTypes: z.array(z.enum(PROPERTY_TYPE_VALUES)).max(6),
  quickFilters: z.array(z.enum(AI_QUICK_VALUES)).max(3),
  flags: z.array(z.enum(AI_FLAG_VALUES as [string, ...string[]])).max(3),
  place: z.string().max(80).nullable(),
  unsupported: z.array(z.enum(AI_GAP_VALUES)).max(8),
});

export type AiSearchResult = z.infer<typeof aiSearchResultSchema>;

/** JSON Schema sent as the structured-output contract. Mirrors aiSearchResultSchema. */
const RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["english", "mode", "minPrice", "maxPrice", "beds", "baths", "propertyTypes", "quickFilters", "flags", "place", "unsupported"],
  properties: {
    english: { type: "boolean", description: "false if the request is not written in English" },
    mode: { type: "string", enum: ["rent", "buy", "unchanged"] },
    minPrice: { type: ["integer", "null"], description: "Lowest price in rand" },
    maxPrice: { type: ["integer", "null"], description: "Highest price in rand" },
    beds: { type: ["integer", "null"], description: "Minimum bedrooms" },
    baths: { type: ["integer", "null"], description: "Minimum bathrooms" },
    propertyTypes: { type: "array", items: { type: "string", enum: [...PROPERTY_TYPE_VALUES] } },
    quickFilters: { type: "array", items: { type: "string", enum: [...AI_QUICK_VALUES] } },
    flags: { type: "array", items: { type: "string", enum: [...AI_FLAG_VALUES] } },
    place: { type: ["string", "null"], description: "A suburb, campus, city or landmark exactly as the person wrote it" },
    unsupported: { type: "array", items: { type: "string", enum: [...AI_GAP_VALUES] } },
  },
} as const;

const SYSTEM_PROMPT = [
  "You turn a South African property search request into filters for Pinpoint.",
  "Reply with JSON only, matching the schema. Never invent details the person did not ask for.",
  "Prices are monthly rent or sale prices in rand. 'R4k' means 4000.",
  "Use null or [] for anything not asked for. mode is 'unchanged' unless they clearly want to rent or buy.",
  "place must be copied exactly from the request (a suburb, campus, city or landmark), or null.",
  "List in 'unsupported' anything they asked for that the other fields cannot express: pets, wifi, parking, move-in (a date), unfurnished, security, distance, or other.",
  "Set english to false if the request is not written in English.",
  "The current search chips are context: only return what the new words add or change.",
].join("\n");

export { getAssistantAiConfig, type AssistantAiConfig } from "./openrouter";

export type AiSearchInput = { text: string; currentChipLabels: string[] };

export type AiSearchOutcome =
  | { ok: true; model: string; result: AiSearchResult }
  | { ok: false; reason: "unavailable" };

/** Tries the main model, then each fallback. Any failure ends in "unavailable", never an exception. */
export async function interpretSearchWithAi(input: AiSearchInput, config: AssistantAiConfig): Promise<AiSearchOutcome> {
  const user = [
    `Request: ${input.text}`,
    `Current chips: ${input.currentChipLabels.length ? input.currentChipLabels.join(" · ") : "none"}`,
  ].join("\n");
  return askStructured({ system: SYSTEM_PROMPT, user, name: "search_filters", jsonSchema: RESPONSE_JSON_SCHEMA, schema: aiSearchResultSchema, maxTokens: 300 }, config);
}

const GENERIC_PLACES = new Set(["campus", "varsity", "university", "uni", "college", "town", "city", "work", "school", "me"]);

function normalize(value: string) {
  return value.toLocaleLowerCase("en-ZA").replace(/[^a-z0-9]+/g, " ").trim();
}

function boundedInt(value: number | null, min: number, max: number) {
  if (value === null || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : undefined;
}

/** Pinpoint's check of the AI's answer (proposal rule 4). Anything doubtful is dropped. */
export function aiResultToSearch(result: AiSearchResult, typedText: string): {
  chips: SearchChip[];
  gaps: SearchGap[];
  notEnglish: boolean;
  removeBuy: boolean;
} {
  if (!result.english) return { chips: [], gaps: [], notEnglish: true, removeBuy: false };
  const chips: SearchChip[] = [];
  if (result.mode === "buy") chips.push({ kind: "mode", value: "buy" });
  const minPrice = boundedInt(result.minPrice, 1, 100_000_000);
  const maxPrice = boundedInt(result.maxPrice, 1, 100_000_000);
  if (minPrice) chips.push({ kind: "minPrice", value: minPrice });
  if (maxPrice) chips.push({ kind: "maxPrice", value: maxPrice });
  const beds = boundedInt(result.beds, 1, 10);
  const baths = boundedInt(result.baths, 1, 10);
  if (beds) chips.push({ kind: "beds", value: beds });
  if (baths) chips.push({ kind: "baths", value: baths });
  for (const value of new Set(result.propertyTypes)) chips.push({ kind: "type", value });
  for (const value of new Set(result.quickFilters)) chips.push({ kind: "quick", value });
  for (const value of new Set(result.flags)) {
    if ((FLAG_VALUES as readonly string[]).includes(value)) chips.push({ kind: "flag", value: value as (typeof FLAG_VALUES)[number] });
  }
  // A place must be words the person actually typed, never one the AI imagined.
  const place = result.place?.trim();
  if (place && !GENERIC_PLACES.has(normalize(place)) && ` ${normalize(typedText)} `.includes(` ${normalize(place)} `)) {
    chips.push({ kind: "near", value: place.slice(0, 60) });
  }
  const gaps = [...new Set(result.unsupported)].map((key) => ({ key, label: GAP_LABELS[key] }));
  return { chips, gaps, notEnglish: false, removeBuy: result.mode === "rent" };
}

/**
 * The final search for typed words: rules first, the AI's checked answer for the rest.
 * Rules win on anything they recognised in these words. Shared by the API and the test-set runner.
 */
export function combineRulesAndAi(text: string, currentChips: readonly SearchChip[], result: AiSearchResult): { chips: SearchChip[]; gaps: SearchGap[]; notEnglish: boolean } {
  const rules = parseSearchText(text, currentChips);
  const ai = aiResultToSearch(result, text);
  if (ai.notEnglish) return { chips: rules.chips, gaps: rules.gaps, notEnglish: true };
  const ruleKinds = new Set(parseSearchText(text).chips.map((chip) => chip.kind));
  let chips = mergeChips(rules.chips, ai.chips.filter((chip) => !ruleKinds.has(chip.kind)));
  if (ai.removeBuy && !ruleKinds.has("mode")) chips = chips.filter((chip) => chip.kind !== "mode");
  const gapKeys = new Set(rules.gaps.map((gap) => gap.key));
  return { chips, gaps: [...rules.gaps, ...ai.gaps.filter((gap) => !gapKeys.has(gap.key))], notEnglish: false };
}
