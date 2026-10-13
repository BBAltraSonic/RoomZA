import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getMarketplaceRedirect, mfaPathForRedirect, safeRedirectPath } from "@/lib/redirects";
import { ensureMarketplaceAccount } from "@/features/auth/marketplace-account";
import { logger } from "@/lib/logger";
import { getAdminMembership } from "@/features/admin/auth";
import { shouldEnterAdminWorkspace } from "@/features/admin/policy";

/**
 * Handle the OAuth/password-recovery callback: exchange the code for a session,
 * read the trigger-created profile, and resolve the user's workspace redirect.
 *
 * Domain logic extracted from the route handler to satisfy feature-first
 * placement (R2.1).
 */
export async function handleAuthCallback(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const callbackError = requestUrl.searchParams.get("error");
  const callbackErrorDescription = requestUrl.searchParams.get("error_description");
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"), "/");

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

      // Auth's database trigger creates the profile.
      // An authenticated upsert attempts to update protected columns and fails.
      const { error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        const authUrl = new URL("/auth", requestUrl.origin);
        authUrl.searchParams.set("error", "callback");
        authUrl.searchParams.set("redirect", next);
        return NextResponse.redirect(authUrl);
      }

      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.data?.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
        return NextResponse.redirect(new URL(mfaPathForRedirect(next), requestUrl.origin));
      }

      const adminMembership = await getAdminMembership(data.user.id);
      if (shouldEnterAdminWorkspace({
        hasActiveMembership: Boolean(adminMembership),
        hasPersona: true,
        requestedPath: next,
      })) {
        return NextResponse.redirect(new URL("/admin", requestUrl.origin));
      }

      const { error: setupError } = await ensureMarketplaceAccount(supabase);
      if (setupError) {
        const authUrl = new URL("/auth", requestUrl.origin);
        authUrl.searchParams.set("error", "setup");
        authUrl.searchParams.set("redirect", next);
        return NextResponse.redirect(authUrl);
      }
      return NextResponse.redirect(new URL(getMarketplaceRedirect(next), requestUrl.origin));
    }
  }

  const authUrl = new URL("/auth", requestUrl.origin);
  authUrl.searchParams.set("error", "callback");
  authUrl.searchParams.set("redirect", next);
  return NextResponse.redirect(authUrl);
}
