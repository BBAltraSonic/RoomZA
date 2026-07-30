import "server-only";

import { getOrganizationContext } from "@/features/organizations/data";
import { createUntypedClient } from "@/lib/supabase/admin";

export async function getImportAccess() {
  const context = await getOrganizationContext();
  const organization = context.activeOrganization;
  if (!organization) {
    return {
      ...context,
      allowed: false,
      reason: "Create or join an organization before importing listings.",
    };
  }
  if (organization.role === "agent") {
    return {
      ...context,
      allowed: false,
      reason: "Only organization owners and admins can access imports.",
    };
  }

  const admin = createUntypedClient();
  const { data: globalFlag } = await admin
    .from("app_feature_flags")
    .select("enabled")
    .eq("key", "bulk_listing_imports")
    .maybeSingle();

  if (!globalFlag?.enabled || !organization.importsPilotEnabled) {
    return {
      ...context,
      allowed: false,
      reason: "Bulk imports are not enabled for this organization yet.",
    };
  }

  return { ...context, allowed: true, reason: null };
}
