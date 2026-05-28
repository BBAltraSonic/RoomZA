"use server";

import { createClient } from "@/lib/supabase/server";

export async function getLiveViewing(viewingId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return { user: null, viewing: null };
  }

  const { data: viewing } = await supabase
    .from("viewings")
    .select(`
      id,
      status,
      meeting_provider,
      meeting_room_id,
      meeting_join_url,
      meeting_starts_at,
      meeting_ends_at,
      slot:viewing_slots(id, start_time, end_time, mode),
      application:applications(
        id,
        full_name,
        renter_id,
        listing:listings(id, title, address, price, landlord_id)
      )
    `)
    .eq("id", viewingId)
    .maybeSingle();

  return { user: userData.user, viewing };
}
