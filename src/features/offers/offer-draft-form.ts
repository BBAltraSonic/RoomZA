import type { CardDraftPresentation } from "@/features/discovery/media-fields";
import { publicContactSchema, type PublicContact } from "@/features/guest-contact/schema";
import { z } from "zod";
import { offerDraftSchema, type OfferDraft } from "./schema";

export const offerTextFields = ["title", "benefit", "terms", "shopName", "address"] as const;
export type OfferFormValues = Record<typeof offerTextFields[number] | "latitude" | "longitude" | "startsAt" | "endsAt", string> & { visitUrl?: string; bookingUrl?: string };

export function offerLocalInput(timestamp?: string) {
  if (!timestamp) return "";
  // South Africa uses UTC+02:00 year-round. The device timezone is irrelevant.
  return new Date(Date.parse(timestamp) + 2 * 3600000).toISOString().slice(0, 19);
}
export function draftFormValues(draft: OfferDraft): OfferFormValues {
  return {
    visitUrl: draft.visitUrl ?? "", bookingUrl: draft.bookingUrl ?? "",
    title: draft.title ?? "", benefit: draft.benefit ?? "", terms: draft.terms ?? "",
    shopName: draft.shopName ?? "", address: draft.address ?? "", latitude: draft.latitude?.toString() ?? "",
    longitude: draft.longitude?.toString() ?? "", startsAt: offerLocalInput(draft.startsAt), endsAt: offerLocalInput(draft.endsAt),
  };
}
export function formOfferDraft(values: OfferFormValues, areaId: string | null, contact?: PublicContact, contactConsent?: boolean, presentation?: CardDraftPresentation): OfferDraft {
  const draft: Record<string, unknown> = {};
  for (const key of ["visitUrl", "bookingUrl"] as const) if (values[key]?.trim()) draft[key] = values[key]!.trim();
  for (const key of offerTextFields) if (values[key].trim()) draft[key] = values[key];
  for (const key of ["latitude", "longitude"] as const) if (values[key].trim()) draft[key] = Number(values[key]);
  for (const key of ["startsAt", "endsAt"] as const) if (values[key]) draft[key] = `${values[key]}${values[key].length === 16 ? ":00" : ""}+02:00`;
  if (areaId) draft.areaId = areaId;
  if (contact) { draft.publicContact = publicContactSchema.parse(contact); draft.contactConsent = contactConsent === true; }
  return offerDraftSchema.parse({ ...draft, ...presentation });
}
export function offerFormError(error: unknown) {
  if (error instanceof z.ZodError) return `Check ${error.issues[0]?.path.join(" ") || "the offer fields"}.`;
  return error instanceof Error ? error.message : "Check the offer fields.";
}
