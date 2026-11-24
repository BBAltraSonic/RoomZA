/**
 * Listing quality check (proposal, template "Quality check"). Rules over the listing's own
 * public fields, its photo count and whether viewing hours are set. Each issue has one fix.
 */

export type QualityListing = {
  id: string;
  title: string | null;
  description: string | null;
  price: number | null;
  listing_type?: string | null;
  availability_date: string | null;
  deposit_amount: number | null;
  electricity_included?: boolean | null;
  water_included?: boolean | null;
  wifi_available?: boolean | null;
  metadata: { amenities?: Partial<Record<string, readonly string[]>> } | null;
};

export type QualityIssue = {
  key: "no-photos" | "few-photos" | "short-description" | "no-move-in-costs" | "no-availability" | "no-utilities" | "no-amenities" | "no-viewing-hours";
  severity: "important" | "helpful";
  message: string;
  fix: string;
  href: string;
};

const MIN_PHOTOS = 5;
const MIN_DESCRIPTION = 120;

export function checkListingQuality(listing: QualityListing, context: { photoCount: number; hasViewingHours: boolean }): QualityIssue[] {
  const edit = `/dashboard/listings/${listing.id}/edit`;
  const issues: QualityIssue[] = [];
  const rent = listing.listing_type !== "sale";
  if (context.photoCount === 0) issues.push({ key: "no-photos", severity: "important", message: "No photos", fix: "Add photos", href: edit });
  else if (context.photoCount < MIN_PHOTOS) {
    issues.push({ key: "few-photos", severity: "helpful", message: `Only ${context.photoCount} photo${context.photoCount === 1 ? "" : "s"}; listings with ${MIN_PHOTOS}+ get more interest`, fix: "Add photos", href: edit });
  }
  if ((listing.description?.trim().length ?? 0) < MIN_DESCRIPTION) issues.push({ key: "short-description", severity: "important", message: "The description is short", fix: "Improve description", href: edit });
  if (rent && !listing.deposit_amount) issues.push({ key: "no-move-in-costs", severity: "important", message: "No move-in costs (deposit)", fix: "Add move-in costs", href: edit });
  if (rent && !listing.availability_date) issues.push({ key: "no-availability", severity: "helpful", message: "No move-in date", fix: "Add move-in date", href: edit });
  if (rent && listing.electricity_included == null && listing.water_included == null && listing.wifi_available == null) {
    issues.push({ key: "no-utilities", severity: "helpful", message: "Electricity, water and Wi-Fi aren't stated", fix: "Add utilities", href: edit });
  }
  const amenityCount = Object.values(listing.metadata?.amenities ?? {}).reduce((total, items) => total + (items?.length ?? 0), 0);
  if (!amenityCount) issues.push({ key: "no-amenities", severity: "helpful", message: "No features listed (parking, security, furnished…)", fix: "Add features", href: edit });
  if (rent && !context.hasViewingHours) issues.push({ key: "no-viewing-hours", severity: "helpful", message: "No viewing hours set", fix: "Set viewing hours", href: edit });
  return issues;
}

export function needsImportantInfo(issues: readonly QualityIssue[]) {
  return issues.some((issue) => issue.severity === "important");
}
