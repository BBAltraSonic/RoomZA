"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { emailVerificationPathForRedirect, getOnboardingDestination, safeRedirectPath } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

const chooseRoleSchema = z.object({
  role: z.enum(["renter", "landlord"]),
  redirect: z.string().optional(),
});

/**
 * Server action: choose a role during onboarding.
 * Domain logic extracted from `src/app/onboarding/actions.ts` (R2.1).
 */
export async function chooseRoleAction(formData: FormData) {
  const submittedRedirect = typeof formData.get("redirect") === "string" ? String(formData.get("redirect")) : undefined;
  const safeSubmittedRedirect = safeRedirectPath(submittedRedirect, "/");
  const parsedInput = chooseRoleSchema.safeParse({
    role: formData.get("role"),
    redirect: submittedRedirect,
  });

  if (!parsedInput.success) {
    redirect(`/onboarding?error=role&redirect=${encodeURIComponent(safeSubmittedRedirect)}`);
  }

  const requestedRole = parsedInput.data.role;
  const requestedRedirect = safeRedirectPath(parsedInput.data.redirect, "/");

  const { user, profile } = await requireUser();
  if (!profile?.email_verified_at) {
    redirect(emailVerificationPathForRedirect(requestedRedirect));
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      role: requestedRole,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    redirect(`/onboarding?error=save&redirect=${encodeURIComponent(requestedRedirect)}`);
  }

  logger.info("Audit role change", {
    audit: true,
    actorId: user.id,
    action: "role_change",
    role: requestedRole,
  });

  redirect(getOnboardingDestination(requestedRole, requestedRedirect));
}
