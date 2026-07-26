import { listingFieldLabels, listingSchema, MIN_LISTING_IMAGES } from "./schema";

export type PublishReadiness = {
  ready: boolean;
  fieldsValid: boolean;
  imageCount: number;
  requiredImageCount: number;
  fieldErrors: string[];
  fieldErrorsByField: Record<string, string[]>;
  imageError: string | null;
};

const requiredFieldGuidance: Record<string, string> = {
  title: "Add a listing headline",
  property_type: "Select a property type",
  price: "Enter the monthly rent",
  sale_price: "Enter the purchase price",
  address: "Search for the property address",
  latitude: "Place the property pin on the map",
  longitude: "Place the property pin on the map",
  bedrooms: "Enter the number of bedrooms",
  bathrooms: "Enter the number of bathrooms",
  parking_type: "Select a parking type",
  parking_count: "Enter the number of parking bays, or 0 if there are none",
  electricity_type: "Select an electricity type",
  water_availability: "Select the water availability",
  lease_duration: "Select a lease term",
  availability_date: "Choose the date the property is available",
};

export function publishFieldMessage(field: string, message: string) {
  const isTechnicalTypeError =
    /expected|received|invalid input|nan/i.test(message);

  return isTechnicalTypeError
    ? requiredFieldGuidance[field] ?? "Complete this required field"
    : message;
}

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
  const fieldErrorsByField: Record<string, string[]> = {};

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    for (const [field, messages] of Object.entries(errors)) {
      const firstMessage = messages?.[0];
      if (firstMessage) {
        const message = publishFieldMessage(field, firstMessage);
        fieldErrorsByField[field] = [message];
        fieldErrors.push(`${listingFieldLabels[field] ?? field}: ${message}`);
      }
    }
  }

  const normalizedImageCount = Math.max(0, Math.floor(Number.isFinite(imageCount) ? imageCount : 0));
  const imageError =
    normalizedImageCount < MIN_LISTING_IMAGES
      ? `Add at least ${MIN_LISTING_IMAGES} photos. You currently have ${normalizedImageCount}.`
      : null;

  return {
    ready: parsed.success && !imageError,
    fieldsValid: parsed.success,
    imageCount: normalizedImageCount,
    requiredImageCount: MIN_LISTING_IMAGES,
    fieldErrors,
    fieldErrorsByField,
    imageError,
  };
}

export function outstandingConditions(readiness: PublishReadiness) {
  return [...readiness.fieldErrors, ...(readiness.imageError ? [readiness.imageError] : [])];
}
