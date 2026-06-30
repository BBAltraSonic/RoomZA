"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getRoleAwareRedirect, safeRedirectPath } from "@/lib/redirects";
import { isRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

/**
 * Server action: choose a role during onboarding.
 * Domain logic extracted from `src/app/onboarding/actions.ts` (R2.1).
 */
export async function chooseRoleAction(formData: FormData) {
  const requestedRole = formData.get("role");
  const requestedRedirect = safeRedirectPath(formData.get("redirect"), "/");

  if (!isRole(requestedRole)) {
    redirect("/onboarding?error=role");
  }

  const { user } = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      role: requestedRole,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    redirect("/onboarding?error=save");
  }

  redirect(getRoleAwareRedirect(requestedRole, requestedRedirect));
}
