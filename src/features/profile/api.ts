import { createClient } from "@/lib/supabase/server";
import { predictResponseTimeSeconds } from "@/features/trust/landlord-signals";
import type { PresenceBadge } from "@/features/presence/presence-status";

export type ListerListing = {
  id: string;
  title: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  created_at: string;
  availability_date: string;
  listing_images?: { public_url: string; sort_order: number }[] | null;
  liveTourId?: string | null;
};

export async function getListerProfile(userId: string) {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, about, role, created_at, phone_verified, email_verified_at, presence_status")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return null;
  }

  const [{ data: listings }, { data: metric }] = await Promise.all([
    supabase
      .from("listings")
      .select(`
        id,
        title,
        address,
        price,
        bedrooms,
        bathrooms,
        created_at,
        availability_date,
        listing_images (public_url, sort_order)
      `)
      .eq("landlord_id", userId)
      .eq("status", "published")
      .order("created_at", { ascending: false }),
    supabase
      .from("landlord_trust_metrics")
      .select("median_first_response_seconds")
      .eq("landlord_id", userId)
      .maybeSingle(),
  ]);

  const listingRows = (listings ?? []) as unknown as ListerListing[];
  const { data: activeTours } = listingRows.length
    ? await supabase.rpc("get_active_public_live_tours", {
        target_listing_ids: listingRows.map((listing) => listing.id),
      })
    : { data: [] };
  const activeTourByListing = new Map(
    (activeTours ?? []).map((tour) => [tour.listing_id, tour.tour_id]),
  );
  const presence: PresenceBadge =
    profile.presence_status === "available" || profile.presence_status === "busy"
      ? profile.presence_status
      : "offline";

  return {
    profile,
    listings: listingRows.map((listing) => ({
      ...listing,
      liveTourId: activeTourByListing.get(listing.id) ?? null,
    })),
    landlordTrust: {
      medianFirstResponseSeconds: metric?.median_first_response_seconds ?? null,
      predictedResponseSeconds: predictResponseTimeSeconds({
        medianFirstResponseSeconds: metric?.median_first_response_seconds ?? null,
        presence,
      }),
      phoneVerified: profile.phone_verified,
      emailVerified: Boolean(profile.email_verified_at),
    },
    landlordPresence: presence,
  };
}
