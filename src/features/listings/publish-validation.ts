import { listingFieldLabels, listingSchema, MIN_LISTING_IMAGES } from "./schema";

export type PublishReadiness = {
  ready: boolean;
  fieldsValid: boolean;
  imageCount: number;
  requiredImageCount: number;
  fieldErrors: string[];
  imageError: string | null;
};

export function evaluatePublishReadiness(listing: unknown, imageCount: number): PublishReadiness {
  // DB rows expose nullable columns (e.g. `description`) where the form schema
  // expects `undefined` for "not provided". Normalize so an optional-but-null
  // field doesn't produce a spurious, un-clearable publish blocker.
  const normalized =
    listing && typeof listing === "object"
      ? { ...(listing as Record<string, unknown>), description: (listing as Record<string, unknown>).description ?? undefined }
      : listing;

  const parsed = listingSchema.safeParse(normalized);
  const fieldErrors: string[] = [];

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    for (const [field, messages] of Object.entries(errors)) {
      if (messages?.length) {
        fieldErrors.push(`${listingFieldLabels[field] ?? field}: ${messages[0]}`);
      }
    }
  }

  const normalizedImageCount = Math.max(0, Math.floor(Number.isFinite(imageCount) ? imageCount : 0));
  const imageError =
    normalizedImageCount < MIN_LISTING_IMAGES
      ? `At least ${MIN_LISTING_IMAGES} images are required (currently ${normalizedImageCount}).`
      : null;

  return {
    ready: parsed.success && !imageError,
    fieldsValid: parsed.success,
    imageCount: normalizedImageCount,
    requiredImageCount: MIN_LISTING_IMAGES,
    fieldErrors,
    imageError,
  };
}

export function outstandingConditions(readiness: PublishReadiness) {
  return [...readiness.fieldErrors, ...(readiness.imageError ? [readiness.imageError] : [])];
}
