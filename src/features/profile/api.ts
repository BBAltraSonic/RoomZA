import { createClient } from "@/lib/supabase/server";

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
};

export async function getListerProfile(userId: string) {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, about, role, created_at, phone_verified, email_verified_at")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return null;
  }

  // Fetch active listings
  const { data: listings, error: listingsError } = await supabase
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
    .order("created_at", { ascending: false });

  return {
    profile,
    listings: (listings ?? []) as unknown as ListerListing[],
  };
}
