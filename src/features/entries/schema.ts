import { specialLinkFields } from "@/features/discovery/special-link-schema";
import { specialMediaFields, dealFields, validateDeal, requireMediaRights, requireSpecialPhotos } from "@/features/discovery/deal-schema";
import { publicContactSchema } from "@/features/guest-contact/schema";
import { z } from "zod";

export const entryCategorySchema = z.enum(["tourism", "event"]);
export type EntryCategory = z.infer<typeof entryCategorySchema>;

// Continuous exact-time windows. Place/venue/authority verification is a
// separate publication dependency, not something content validation proves.
const entryContentObject = z.object({
  ...specialMediaFields, ...dealFields, ...specialLinkFields,
  publicContact: publicContactSchema.optional(),
  contactConsent: z.boolean().optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000),
  venueName: z.string().trim().min(1).max(160),
  areaId: z.string().uuid(),
  address: z.string().trim().min(1).max(500),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
}).strict();
export const entryContentSchema = entryContentObject.superRefine(validateDeal);
export const entryDraftSchema = entryContentObject.partial().superRefine(validateDeal);
export type EntryContent = Readonly<z.infer<typeof entryContentSchema>>;
export type EntryDraft = Readonly<z.infer<typeof entryDraftSchema>>;

export function parseEntrySubmission(value: unknown, now: number): EntryContent {
  const content = validateEntryRevision(value, now);
  requireSpecialPhotos(content);
  return content;
}

// Public content and previously submitted revisions retain optional legacy media.
export function validateEntryRevision(value: unknown, now: number): EntryContent {
  if (!Number.isFinite(now)) throw new Error("Invalid entry clock");
  const content = entryContentSchema.parse(value);
  requireMediaRights(content);
  const start = Date.parse(content.startsAt), end = Date.parse(content.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error("Entry end must be after its start");
  }
  if (end <= now) throw new Error("Entry must end in the future");
  return Object.freeze({
    ...content, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(),
  });
}

// Temporal classification only. Public Events display from approval until
// their exact end with Upcoming before start; Tourism requires its live window.
export function entryWindowState(content: EntryContent, now: number) {
  const start = Date.parse(content.startsAt), end = Date.parse(content.endsAt);
  if (!Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return "unavailable" as const;
  }
  return now >= end ? "ended" as const : now < start ? "scheduled" as const : "available" as const;
}

export function formatEntryTimeSast(value: string) {
  const instant = Date.parse(z.string().datetime({ offset: true }).parse(value));
  if (!Number.isFinite(instant)) throw new Error("Invalid entry time");
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short", hour12: false,
  }).format(instant) + " SAST";
}
