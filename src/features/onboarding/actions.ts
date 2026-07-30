"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { marketplacePersonas } from "@/lib/personas";
import {
  emailVerificationPathForRedirect,
  getPersonaOnboardingDestination,
  safeRedirectPath,
} from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

const chooseRoleSchema = z.object({
  role: z.enum(marketplacePersonas),
  redirect: z.string().optional(),
});

/**
 * Server action: choose a role during onboarding.
 * Domain logic extracted from `src/app/onboarding/actions.ts` (R2.1).
 */
export async function chooseRoleAction(formData: FormData) {
  const submittedRedirect =
    typeof formData.get("redirect") === "string"
      ? String(formData.get("redirect"))
      : undefined;
  const safeSubmittedRedirect = safeRedirectPath(submittedRedirect, "/");
  const parsedInput = chooseRoleSchema.safeParse({
    role: formData.get("role"),
    redirect: submittedRedirect,
  });

  if (!parsedInput.success) {
    redirect(
      `/onboarding?error=role&redirect=${encodeURIComponent(safeSubmittedRedirect)}`,
    );
  }

  const requestedRole = parsedInput.data.role;
  const requestedRedirect = safeRedirectPath(parsedInput.data.redirect, "/");

  const { user, profile } = await requireUser();
  if (!profile?.email_verified_at) {
    redirect(emailVerificationPathForRedirect(requestedRedirect));
  }

  const supabase = await createClient();

  const { count } = await supabase
    .from("profile_personas")
    .select("persona", { count: "exact", head: true })
    .eq("profile_id", user.id);
  const first = (count ?? 0) === 0;
  const { error } = await supabase.from("profile_personas").upsert({
    profile_id: user.id,
    persona: requestedRole,
    is_primary: first,
    is_active: first,
  });

  if (error) {
    redirect(
      `/onboarding?error=save&redirect=${encodeURIComponent(requestedRedirect)}`,
    );
  }
  await supabase
    .from(`${requestedRole}_profile_details`)
    .upsert({ profile_id: user.id });
  await supabase.rpc("set_active_profile_persona", {
    target_persona: requestedRole,
  });

  logger.info("Audit role change", {
    audit: true,
    actorId: user.id,
    action: "role_change",
    role: requestedRole,
  });

  redirect(getPersonaOnboardingDestination(requestedRole, requestedRedirect));
}
