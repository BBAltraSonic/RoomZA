import { getAdminMembership } from "@/features/admin/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const membership = user ? await getAdminMembership(user.id) : null;
  return Response.json({ hasAdminAccess: Boolean(membership) }, { headers: { "cache-control": "private, no-store" } });
}
