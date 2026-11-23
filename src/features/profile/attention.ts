import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Needs your attention" on the profile overview: only things waiting on this person.
 * Totals that are not a to-do (saved homes, all messages) live elsewhere, in the dock.
 */
export type AttentionCounts = {
  /** Applications on homes this person lists that still need a decision. */
  applicationsToReview: number;
  /** This person's own applications that were approved and need following up. */
  approvedApplications: number;
  /** Viewings this person is booked to attend, for a rental or a purchase. */
  bookedViewings: number;
};

export type AttentionItem = { key: keyof AttentionCounts; label: string; href: string };
export type AttentionResult = { items: AttentionItem[]; incomplete: boolean };

const wording: Record<keyof AttentionCounts, { one: string; many: string; href: string }> = {
  applicationsToReview: { one: "application to review", many: "applications to review", href: "/dashboard/applicants" },
  approvedApplications: { one: "approved application to follow up", many: "approved applications to follow up", href: "/applications" },
  bookedViewings: { one: "viewing booked", many: "viewings booked", href: "/viewings" },
};

export function buildAttentionItems(counts: AttentionCounts): AttentionItem[] {
  return (Object.keys(wording) as (keyof AttentionCounts)[])
    .filter(key => counts[key] > 0)
    .map(key => ({ key, label: `${counts[key]} ${counts[key] === 1 ? wording[key].one : wording[key].many}`, href: wording[key].href }));
}

type CountResult = { count: number | null; error: unknown };
const head = { count: "exact", head: true } as const;

/** Reads the counts in parallel; a failed count is left out and reported, never shown as zero. */
export async function getAttentionItems(client: SupabaseClient, profileId: string): Promise<AttentionResult> {
  const results: CountResult[] = await Promise.all([
    client.from("applications").select("id,listings!inner(landlord_id)", head)
      .eq("listings.landlord_id", profileId).in("status", ["submitted", "under_review"]),
    client.from("applications").select("id", head).eq("renter_id", profileId).eq("status", "approved"),
    client.from("viewings").select("id,applications!inner(renter_id)", head)
      .eq("applications.renter_id", profileId).eq("status", "booked"),
    client.from("viewings").select("id,buyer_interests!inner(buyer_id)", head)
      .eq("buyer_interests.buyer_id", profileId).eq("status", "booked"),
  ]);
  const value = (result: CountResult) => (result.error || result.count === null ? null : result.count);
  const [toReview, approved, rentalViewings, purchaseViewings] = results.map(value);
  const incomplete = results.some(result => value(result) === null);
  return {
    incomplete,
    items: buildAttentionItems({
      applicationsToReview: toReview ?? 0,
      approvedApplications: approved ?? 0,
      bookedViewings: (rentalViewings ?? 0) + (purchaseViewings ?? 0),
    }),
  };
}
