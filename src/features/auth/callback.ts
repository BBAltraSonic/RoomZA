import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { emailVerificationPathForRedirect, getRoleAwareRedirect, onboardingPathForRedirect, safeRedirectPath } from "@/lib/redirects";
import { isRole } from "@/lib/roles";
import { logger } from "@/lib/logger";
import { getAdminMembership } from "@/features/admin/auth";
import { shouldEnterAdminWorkspace } from "@/features/admin/policy";

/**
 * Handle the OAuth/email-verification callback: exchange the code for a session,
 * upsert the profile, and resolve the redirect path based on the user's role.
 *
 * Domain logic extracted from the route handler to satisfy feature-first
 * placement (R2.1).
 */
export async function handleAuthCallback(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const callbackError = requestUrl.searchParams.get("error");
  const callbackErrorDescription = requestUrl.searchParams.get("error_description");
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"), "/onboarding");

  if (callbackError) {
    logger.warn("Auth callback rejected", { error: callbackError, description: callbackErrorDescription });
    const authUrl = new URL("/auth", requestUrl.origin);
    authUrl.searchParams.set("error", "callback");
    authUrl.searchParams.set("redirect", next);
    return NextResponse.redirect(authUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.warn("Auth callback exchange failed", { error });
      const authUrl = new URL("/auth", requestUrl.origin);
      authUrl.searchParams.set("error", "callback");
      authUrl.searchParams.set("redirect", next);
      return NextResponse.redirect(authUrl);
    }

    if (data.user) {
      // Password-recovery links must land on the reset form regardless of role.
      if (next.startsWith("/auth/reset-password")) {
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }

      const { data: profile } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email: data.user.email ?? "",
          email_verified_at: data.user.email_confirmed_at ?? null,
        },
        { onConflict: "id" },
      ).select("role,email_verified_at").single();

      if (!profile?.email_verified_at) {
        return NextResponse.redirect(new URL(emailVerificationPathForRedirect(next), requestUrl.origin));
      }

      const adminMembership = await getAdminMembership(data.user.id);
      if (shouldEnterAdminWorkspace({
        hasActiveMembership: Boolean(adminMembership),
        hasPersona: isRole(profile?.role),
        requestedPath: next,
      })) {
        return NextResponse.redirect(new URL("/admin", requestUrl.origin));
      }

      const redirectPath = isRole(profile?.role)
        ? getRoleAwareRedirect(profile.role, next)
        : onboardingPathForRedirect(next);

      return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
    }
  }

  const authUrl = new URL("/auth", requestUrl.origin);
  authUrl.searchParams.set("error", "callback");
  authUrl.searchParams.set("redirect", next);
  return NextResponse.redirect(authUrl);
}
