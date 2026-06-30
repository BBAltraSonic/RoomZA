import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getRoleAwareRedirect, onboardingPathForRedirect, safeRedirectPath } from "@/lib/redirects";
import { isRole } from "@/lib/roles";

/**
 * Handle the OAuth/email-verification callback: exchange the code for a session,
 * upsert the profile, and resolve the redirect path based on the user's role.
 *
 * Domain logic extracted from the route handler to satisfy feature-first
 * placement (R2.1).
 */
export async function handleAuthCallback(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"), "/onboarding");

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (data.user) {
      // Password-recovery links must land on the reset form regardless of role.
      if (next.startsWith("/auth/reset-password")) {
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }

      const { data: profile } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email: data.user.email ?? "",
        },
        { onConflict: "id" },
      ).select("role").single();

      const redirectPath = isRole(profile?.role)
        ? getRoleAwareRedirect(profile.role, next)
        : onboardingPathForRedirect(next);

      return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
