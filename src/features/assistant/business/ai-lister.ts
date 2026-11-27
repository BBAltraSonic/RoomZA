import "server-only";

import { z } from "zod";

import { askStructured, type AssistantAiConfig } from "../openrouter";
import { STAGES } from "./people";
import { CHANGE_KINDS, type BusinessRequest } from "./request-intent";

/**
 * AI job 2: lister request -> template and filters. The AI receives only the words just typed,
 * with contact details stripped and the lister's people's names replaced by "[person]". It never
 * sees records. Pinpoint checks every field; anything doubtful falls back to Today.
 */

const AI_TEMPLATES = ["today", "people_list", "question_insights", "new_listing", "quality_check", "performance", "change_preview", "viewing_slots", "reminders"] as const;
const AI_CHANGES = CHANGE_KINDS.filter((kind) => kind !== "decline_viewing");
const OPEN_STAGES = STAGES.filter((stage) => stage !== "closed");

export const aiListerResultSchema = z.object({
  template: z.enum(AI_TEMPLATES),
  stage: z.enum(OPEN_STAGES as [string, ...string[]]).nullable(),
  waitingOnYou: z.boolean(),
  since: z.enum(["today", "week", "month"]).nullable(),
  maxPrice: z.number().nullable(),
  minPrice: z.number().nullable(),
  change: z.enum(AI_CHANGES as [string, ...string[]]).nullable(),
  percent: z.number().nullable(),
  amount: z.number().nullable(),
  reminderText: z.string().max(200).nullable(),
  reminderDue: z.enum(["today", "tomorrow", "next-week", "friday"]).nullable(),
});
export type AiListerResult = z.infer<typeof aiListerResultSchema>;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["template", "stage", "waitingOnYou", "since", "maxPrice", "minPrice", "change", "percent", "amount", "reminderText", "reminderDue"],
  properties: {
    template: { type: "string", enum: [...AI_TEMPLATES] },
    stage: { type: ["string", "null"], enum: [...OPEN_STAGES, null] },
    waitingOnYou: { type: "boolean" },
    since: { type: ["string", "null"], enum: ["today", "week", "month", null] },
    maxPrice: { type: ["integer", "null"] },
    minPrice: { type: ["integer", "null"] },
    change: { type: ["string", "null"], enum: [...AI_CHANGES, null] },
    percent: { type: ["integer", "null"], description: "Price change in percent, negative to lower" },
    amount: { type: ["integer", "null"], description: "New price in rand" },
    reminderText: { type: ["string", "null"] },
    reminderDue: { type: ["string", "null"], enum: ["today", "tomorrow", "next-week", "friday", null] },
  },
} as const;

const SYSTEM_PROMPT = [
  "You route a South African property lister's request to one Pinpoint screen.",
  "Reply with JSON only, matching the schema. Never invent details they did not ask for.",
  "Screens: today (what needs attention), people_list (people who enquired, filtered), question_insights (what people ask about),",
  "new_listing (help creating a listing), quality_check (what's missing on listings), performance (views, enquiries, how listings are doing),",
  "change_preview (a change they want made: accept viewings, review applications, mark a listing let, change prices, archive quiet people),",
  "viewing_slots (viewing times to offer), reminders (set or see reminders).",
  "stage is one of applied, viewing-booked, ready-to-apply, just-enquired, gone-quiet. Prices are rand per month. '[person]' stands for someone the lister knows.",
  "Use null, false or the closest screen when unsure.",
].join("\n");

export async function routeListerRequestWithAi(text: string, config: AssistantAiConfig) {
  return askStructured({ system: SYSTEM_PROMPT, user: `Request: ${text}`, name: "lister_request", jsonSchema: JSON_SCHEMA, schema: aiListerResultSchema, maxTokens: 250 }, config);
}

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return rounded > 0 && rounded <= 100_000_000 ? rounded : undefined;
}

/** Pinpoint's check of the AI's answer (proposal rule 4). */
export function aiResultToRequest(result: AiListerResult, typed: string): BusinessRequest {
  switch (result.template) {
    case "people_list": {
      const maxPrice = money(result.maxPrice);
      const minPrice = money(result.minPrice);
      return {
        template: "people_list",
        filters: {
          ...(result.stage ? { stage: result.stage as (typeof OPEN_STAGES)[number] } : {}),
          ...(result.waitingOnYou ? { waitingOnYou: true } : {}),
          ...(result.since ? { since: result.since } : {}),
          ...(maxPrice ? { maxPrice } : {}),
          ...(minPrice && (!maxPrice || minPrice <= maxPrice) ? { minPrice } : {}),
        },
      };
    }
    case "change_preview": {
      if (!result.change) return { template: "today" };
      if (result.change === "change_price") {
        const percent = result.percent !== null && Math.abs(result.percent) >= 1 && Math.abs(result.percent) <= 50 ? Math.round(result.percent) : undefined;
        const amount = money(result.amount);
        if (!percent && !amount) return { template: "performance" };
        return { template: "change_preview", change: { kind: "change_price", ...(percent ? { percent } : { amount }) } };
      }
      return { template: "change_preview", change: { kind: result.change as "accept_viewings" | "review_applications" | "archive_quiet" | "mark_let" } };
    }
    case "reminders":
      return result.reminderText?.trim()
        ? { template: "reminders", create: { text: result.reminderText.trim().slice(0, 200), due: result.reminderDue ?? "tomorrow" } }
        : { template: "reminders" };
    case "new_listing":
      return { template: "new_listing", draft: { notes: typed.slice(0, 1000) } };
    default:
      return { template: result.template };
  }
}
