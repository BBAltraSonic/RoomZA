import "server-only";

import { createUntypedClient } from "@/lib/supabase/admin";

export async function getActiveSensitiveGrant(input: {
  adminId: string;
  caseId: string;
  resourceType: "conversation" | "document";
  resourceId: string;
}) {
  const admin = createUntypedClient();
  const { data: grant } = await admin
    .from("sensitive_access_grants")
    .select("id, reason, expires_at")
    .eq("admin_id", input.adminId)
    .eq("case_id", input.caseId)
    .eq("resource_type", input.resourceType)
    .eq("resource_id", input.resourceId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!grant) return null;

  const { data: moderationCase } = await admin
    .from("moderation_cases")
    .select("id, status")
    .eq("id", input.caseId)
    .in("status", ["open", "in_review"])
    .maybeSingle();
  return moderationCase ? grant : null;
}
