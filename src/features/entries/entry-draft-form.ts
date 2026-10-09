import { z } from "zod";
import { entryDraftSchema, type EntryDraft } from "./schema";

const textFields = ["title", "description", "venueName", "address"] as const;
type TextField = typeof textFields[number];
export type EntryFormValues = Record<TextField | "latitude" | "longitude" | "startsAt" | "endsAt", string>;

export function entryLocalInput(timestamp?: string) {
  if (!timestamp) return "";
  return new Date(Date.parse(timestamp) + 2 * 60 * 60 * 1000).toISOString().slice(0, 19);
}

export function entryDraftFormValues(draft: EntryDraft): EntryFormValues {
  return {
    title: draft.title ?? "", description: draft.description ?? "", venueName: draft.venueName ?? "", address: draft.address ?? "",
    latitude: draft.latitude?.toString() ?? "", longitude: draft.longitude?.toString() ?? "",
    startsAt: entryLocalInput(draft.startsAt), endsAt: entryLocalInput(draft.endsAt),
  };
}

export function formEntryDraft(values: EntryFormValues, areaId: string | null): EntryDraft {
  const draft: Record<string, unknown> = {};
  for (const key of textFields) if (values[key].trim()) draft[key] = values[key];
  for (const key of ["latitude", "longitude"] as const) if (values[key].trim()) draft[key] = Number(values[key]);
  for (const key of ["startsAt", "endsAt"] as const) if (values[key]) draft[key] = `${values[key]}${values[key].length === 16 ? ":00" : ""}+02:00`;
  if (areaId) draft.areaId = areaId;
  return entryDraftSchema.parse(draft);
}

export function entryFormError(error: unknown) {
  if (error instanceof z.ZodError) return `Check ${error.issues[0]?.path.join(" ") || "the entry fields"}.`;
  return error instanceof Error ? error.message : "Check the entry fields.";
}
