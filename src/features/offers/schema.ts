import { specialLinkFields } from "@/features/discovery/special-link-schema";
import { specialMediaFields, dealFields, validateDeal, requireMediaRights, requireSpecialPhotos } from "@/features/discovery/deal-schema";
import { publicContactSchema } from "@/features/guest-contact/schema";
import { z } from "zod";

// Publication fields for the first directions-based Shopping Offer slice.
// The persistence adapter must additionally resolve areaId to a stored South
// African place and enforce poster/media permissions before accepting a submit.
const offerContentObject = z.object({
  ...specialMediaFields, ...dealFields, ...specialLinkFields,
  publicContact: publicContactSchema.optional(),
  contactConsent: z.boolean().optional(),
  title: z.string().trim().min(1).max(160),
  benefit: z.string().trim().min(1).max(500),
  terms: z.string().trim().min(1).max(4000),
  shopName: z.string().trim().min(1).max(160),
  areaId: z.string().uuid(),
  address: z.string().trim().min(1).max(500),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
}).strict();

export const offerContentSchema = offerContentObject.superRefine(validateDeal);
export const offerDraftSchema = offerContentObject.partial().superRefine(validateDeal);
export type OfferContent = Readonly<z.infer<typeof offerContentSchema>>;
export type OfferDraft = Readonly<z.infer<typeof offerDraftSchema>>;

export function parseOfferSubmission(draft: unknown, now: number): OfferContent {
  const content = validateOfferRevision(draft, now);
  requireSpecialPhotos(content);
  return content;
}

// Review existing snapshots without retroactively requiring photos on legacy revisions.
export function validateOfferRevision(draft: unknown, now: number): OfferContent {
  if (!Number.isFinite(now)) throw new Error("Invalid offer clock");
  const content = offerContentSchema.parse(draft);
  requireMediaRights(content);
  const start = Date.parse(content.startsAt);
  const end = Date.parse(content.endsAt);
  if (start >= end) throw new Error("Offer end must be after its start");
  if (end <= now) throw new Error("Offer must end in the future");
  return Object.freeze({
    ...content,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
  });
}
