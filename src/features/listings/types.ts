import type { Database } from "@/lib/supabase/types";
import type { ActionResult, Ok, Err } from "@/lib/action-result";
import type { ApplicationStatus } from "@/features/applications/transitions";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 10 * 1024 * 1024;

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

  if (size > maxImageSize) {
    return { valid: false, error: "Image must be smaller than 10 MB." };
  }

  return { valid: true };
}

export function hasBlockingApplications(statuses: ApplicationStatus[]) {
  return statuses.some((status) => status === "submitted" || status === "under_review" || status === "shortlisted" || status === "approved");
}
