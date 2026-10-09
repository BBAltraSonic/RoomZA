import type { SupabaseClient } from "@supabase/supabase-js";

import { isMarketplacePersona } from "@/lib/personas";
import type { Database } from "@/lib/supabase/types";

/** Enroll a public workspace using the authenticated user's RLS permissions. */
export async function enrollSignupPersona(
  supabase: SupabaseClient<Database>,
  userId: string,
  requestedPersona: unknown,
) {
  // Metadata is only a preference for a user-selectable marketplace role.
  // It cannot grant administrative membership or reviewer access.
  if (!isMarketplacePersona(requestedPersona)) return { persona: null, error: null };

  const { data: existing, error: readError } = await supabase
    .from("profile_personas")
    .select("persona,is_active")
    .eq("profile_id", userId)
    .order("created_at");
  if (readError) return { persona: null, error: readError };
  const firstPersona = existing?.[0];
  if (firstPersona) {
    return { persona: existing?.find((row) => row.is_active)?.persona ?? firstPersona.persona, error: null };
  }

  const { error: detailsError } = await supabase
    .from(`${requestedPersona}_profile_details`)
    .upsert({ profile_id: userId }, { onConflict: "profile_id", ignoreDuplicates: true });
  if (detailsError) return { persona: null, error: detailsError };

  const { error } = await supabase.from("profile_personas").insert({
    profile_id: userId,
    persona: requestedPersona,
    is_primary: true,
    is_active: true,
  });
  return { persona: error ? null : requestedPersona, error };
}
