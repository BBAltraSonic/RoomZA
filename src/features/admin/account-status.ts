import "server-only";

import { createUntypedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function getSuspendedAccountStatus() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthenticated" as const };
  const admin = createUntypedClient();
  const { data: suspension } = await admin.from("account_suspensions").select("reason, suspended_until").eq("user_id", user.id).is("restored_at", null).maybeSingle();
  if (!suspension || (suspension.suspended_until && new Date(suspension.suspended_until) <= new Date())) return { kind: "active" as const };
  return { kind: "suspended" as const, suspension };
}
