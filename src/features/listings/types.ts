import type { ApplicationStatus } from "@/features/applications/transitions";

export type { ApplicationStatus };

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_LISTING_IMAGES = 20;
export const MAX_LISTING_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export function duplicateTitle(title: string) {
  const trimmed = title.trim();
  return `${trimmed || "Untitled listing"} (Copy)`;
}

export function validateImageUpload(type: string, size: number): { valid: true } | { valid: false; error: string } {
  if (!imageTypes.has(type)) {
    return { valid: false, error: "Only JPEG, PNG, and WebP images are allowed." };
  }

  if (!Number.isFinite(size) || size <= 0) {
    return { valid: false, error: "Image must not be empty." };
  }

  if (size > MAX_LISTING_IMAGE_SIZE_BYTES) {
    return { valid: false, error: "Image must be smaller than 10 MB." };
  }

  return { valid: true };
}

export function validateListingImageCount(existingImageCount: number, newImageCount: number): { valid: true } | { valid: false; error: string } {
  const existing = Math.max(0, Math.floor(Number.isFinite(existingImageCount) ? existingImageCount : 0));
  const incoming = Math.max(0, Math.floor(Number.isFinite(newImageCount) ? newImageCount : 0));

  if (incoming < 1) {
    return { valid: false, error: "Upload at least 1 image." };
  }

  if (existing + incoming > MAX_LISTING_IMAGES) {
    return { valid: false, error: `Listing images are limited to ${MAX_LISTING_IMAGES} total.` };
  }

  return { valid: true };
}

export function hasBlockingApplications(statuses: ApplicationStatus[]) {
  return statuses.some((status) => status === "submitted" || status === "under_review" || status === "shortlisted" || status === "approved");
}
