import { z } from "zod";

import { STAGES } from "./people";
import type { BusinessRequest, ChangeRequest } from "./request-intent";

/**
 * Checks a business request that arrives from the browser (a chip tap, a button, a template
 * link). Server functions can be called directly, so nothing the panel sends is trusted.
 */

const id = z.string().uuid();
/** `customerId:listingId`, as built by `buildPeople`. */
export const personKeySchema = z.string().regex(/^[0-9a-f-]{36}:[0-9a-f-]{36}$/i);
const money = z.number().int().positive().max(100_000_000);

export const changeRequestSchema: z.ZodType<ChangeRequest> = z.union([
  z.object({ kind: z.enum(["accept_viewings", "review_applications"]), listingId: id.optional(), personKey: personKeySchema.optional() }).strict(),
  z.object({ kind: z.enum(["archive_quiet", "mark_let"]), listingId: id.optional() }).strict(),
  z.object({ kind: z.literal("decline_viewing"), personKey: personKeySchema }).strict(),
  z.object({ kind: z.literal("change_price"), listingId: id.optional(), percent: z.number().int().min(-50).max(50).refine((value) => value !== 0).optional(), amount: money.optional() })
    .strict()
    .refine((value) => (value.percent === undefined) !== (value.amount === undefined), "Give a percent or an amount, not both."),
]);

const peopleFiltersSchema = z.object({
  stage: z.enum(STAGES).optional(),
  waitingOnYou: z.boolean().optional(),
  maxPrice: money.optional(),
  minPrice: money.optional(),
  subjectId: id.optional(),
  since: z.enum(["today", "week", "month"]).optional(),
  includeClosed: z.boolean().optional(),
}).strict();

const draftSchema = z.object({
  propertyType: z.string().max(40).optional(),
  bedrooms: z.number().int().min(0).max(50).optional(),
  bathrooms: z.number().int().min(0).max(50).optional(),
  price: money.optional(),
  listingType: z.enum(["rent", "sale"]).optional(),
  area: z.string().max(120).optional(),
  notes: z.string().max(1000),
}).strict();

const reminderRequestSchema = z.object({
  text: z.string().trim().min(1).max(200),
  due: z.enum(["today", "tomorrow", "next-week", "friday"]).nullable(),
}).strict();

export const businessRequestSchema: z.ZodType<BusinessRequest> = z.discriminatedUnion("template", [
  z.object({ template: z.literal("today") }).strict(),
  z.object({ template: z.literal("people_list"), filters: peopleFiltersSchema }).strict(),
  z.object({ template: z.literal("person_detail"), personKey: personKeySchema }).strict(),
  z.object({ template: z.literal("question_insights"), listingId: id.optional() }).strict(),
  z.object({ template: z.literal("new_listing"), draft: draftSchema }).strict(),
  z.object({ template: z.literal("quality_check"), listingId: id.optional() }).strict(),
  z.object({ template: z.literal("improve_listing"), listingId: id }).strict(),
  z.object({ template: z.literal("performance"), listingId: id.optional() }).strict(),
  z.object({ template: z.literal("change_preview"), change: changeRequestSchema }).strict(),
  z.object({ template: z.literal("viewing_slots"), personKey: personKeySchema.optional() }).strict(),
  z.object({ template: z.literal("reminders"), create: reminderRequestSchema.optional() }).strict(),
]) as z.ZodType<BusinessRequest>;
