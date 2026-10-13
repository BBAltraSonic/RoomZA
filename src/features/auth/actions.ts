"use server";

import { AuthApiError } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAdminMembership } from "@/features/admin/auth";
import { shouldEnterAdminWorkspace } from "@/features/admin/policy";
import { ensureMarketplaceAccount } from "@/features/auth/marketplace-account";
import { SIGN_OUT_REDIRECT_PATH } from "@/features/auth/sign-out";
import { LOGIN_FAILURE_MESSAGE } from "@/features/auth/login-lockout";
import {
  clearLoginFailures,
  readLoginLockout,
  recordFailedLogin,
} from "@/features/auth/login-lockout-store";
import {
  PASSWORD_RESET_INVALID_MESSAGE,
  PASSWORD_RESET_SUCCESS_MESSAGE,
} from "@/features/auth/password-reset";
import {
  authCredentialsSchema,
  firstSchemaError,
  passwordResetRequestSchema,
  signUpCredentialsSchema,
  updatePasswordSchema,
} from "@/features/auth/schemas";
import {
  authCookieOptions,
  isSupabaseAuthCookie,
} from "@/features/auth/session-persistence";
import {
  getMarketplaceRedirect,
  mfaPathForRedirect,
  safeRedirectPath,
} from "@/lib/redirects";
import {
  AUTH_RATE_LIMIT,
  consumeRateLimit,
  getClientIpFromHeaders,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { logger } from "@/lib/logger";
import {
  recordCurrentPolicyAcceptances,
  recordSignupMarketingChoice,
} from "@/features/trust/acceptance";

type AuthState = {
  message?: string;
  /** When true, the message is informational/success rather than an error. */
  success?: boolean;
};

const AUTH_RATE_LIMITED_MESSAGE = "Too many requests. Try again later.";

async function checkAuthRateLimit(action: string): Promise<AuthState | null> {
  const hdrs = await headers();
  const ip = getClientIpFromHeaders(hdrs);
  const limit = await consumeRateLimit({
    key: `auth:${action}:${ip}`,
    requests: AUTH_RATE_LIMIT.requests,
    window: AUTH_RATE_LIMIT.window,
  });

  return limit.success ? null : { message: AUTH_RATE_LIMITED_MESSAGE };
}

/**
 * Verifies the Turnstile token from an auth form submission.
 * Production fails closed when Turnstile is not configured. Local and test
 * environments can still run auth flows without the widget.
 * Returns an error message string when verification fails, otherwise null.
 */
async function checkTurnstile(formData: FormData): Promise<string | null> {
  if (
    !process.env.TURNSTILE_SECRET_KEY &&
    process.env.NODE_ENV !== "production"
  )
    return null;

  const token = formData.get("cf-turnstile-response");
  const hdrs = await headers();
  const ip = getClientIpFromHeaders(hdrs);

  const ok = await verifyTurnstileToken(
    typeof token === "string" ? token : null,
    ip,
  );
  return ok ? null : "Verification failed. Please try again.";
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof AuthApiError) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

async function resolveRequestOrigin(): Promise<string> {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

async function applyAuthCookiePersistence(remember: boolean) {
  const cookieStore = await cookies();
  const options = authCookieOptions(remember);

  for (const cookie of cookieStore.getAll()) {
    if (isSupabaseAuthCookie(cookie.name)) {
      cookieStore.set(cookie.name, cookie.value, options);
    }
  }
}

export async function signInWithGoogleAction(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rateLimitError = await checkAuthRateLimit("google");
  if (rateLimitError) return rateLimitError;

  const next = safeRedirectPath(formData.get("redirect"), "/");
  let authorizeUrl: string;
  try {
    const callbackUrl = new URL("/auth/callback", await resolveRequestOrigin());
    callbackUrl.searchParams.set("next", next);
    const supabase = await createClient();
    // The server client stores the PKCE verifier in a cookie for the callback.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString(), skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      return { message: "Google sign-in could not start. Please try again." };
    }
    authorizeUrl = data.url;
  } catch {
    return { message: "Google sign-in could not start. Please try again." };
  }

  // Next.js redirects throw; keep this outside the error handler.
  redirect(authorizeUrl);
}

export async function signInAction(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rateLimitError = await checkAuthRateLimit("sign-in");
  if (rateLimitError) return rateLimitError;

  const credentials = authCredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const requestedRedirect = safeRedirectPath(formData.get("redirect"), "/");
  const remember = formData.get("remember") === "on";

  if (!credentials.success) {
    return { message: firstSchemaError(credentials.error) };
  }

  const turnstileError = await checkTurnstile(formData);
  if (turnstileError) {
    return { message: turnstileError };
  }

  const lockout = await readLoginLockout(credentials.data.email);
  if (!lockout.ok || lockout.status.locked) {
    return { message: LOGIN_FAILURE_MESSAGE };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials.data);

  if (error) {
    await recordFailedLogin(lockout.emailHash);
    return { message: LOGIN_FAILURE_MESSAGE };
  }

  await clearLoginFailures(lockout.emailHash);
  await applyAuthCookiePersistence(remember);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  logger.info("Audit login", {
    audit: true,
    actorId: user.id,
    action: "login",
  });

  const assurance = await supabase.auth.mfa?.getAuthenticatorAssuranceLevel();
  if (
    assurance?.data?.nextLevel === "aal2" &&
    assurance.data.currentLevel !== "aal2"
  ) {
    redirect(mfaPathForRedirect(requestedRedirect));
  }

  const adminMembership = await getAdminMembership(user.id);
  if (
    shouldEnterAdminWorkspace({
      hasActiveMembership: Boolean(adminMembership),
      hasPersona: true,
      requestedPath: requestedRedirect,
    })
  ) {
    redirect("/admin");
  }

  const { error: setupError } = await ensureMarketplaceAccount(supabase);
  if (setupError) return { message: "Your account setup could not finish. Try signing in again." };
  redirect(getMarketplaceRedirect(requestedRedirect));
}

export async function signUpAction(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rateLimitError = await checkAuthRateLimit("sign-up");
  if (rateLimitError) return rateLimitError;

  const credentials = signUpCredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  const requestedRedirect = safeRedirectPath(formData.get("redirect"), "/");
  const acceptedPolicies = formData.get("acceptPolicies") === "on";
  const marketingConsent = formData.get("marketing") === "on";

  if (!credentials.success) {
    return { message: firstSchemaError(credentials.error) };
  }
  if (!acceptedPolicies)
    return {
      message:
        "Accept the Terms of Service and Privacy Policy to create an account.",
    };

  const turnstileError = await checkTurnstile(formData);
  if (turnstileError) {
    return { message: turnstileError };
  }

  const supabase = await createClient();
  const authCredentials = {
    email: credentials.data.email,
    password: credentials.data.password,
  };

  const { data, error } = await supabase.auth.signUp(authCredentials);

  if (error) {
    return { message: getAuthErrorMessage(error) };
  }

  // Account setup requires an authenticated session. Never write as anon if
  // the provider returns only a user (for example an existing account).
  if (data.user && data.session) {
    const { error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.user.id)
      .single();

    if (profileError) {
      return { message: "Your account was created, but setup failed. Sign in to continue." };
    }

    const signupRequestId =
      (await headers()).get("x-request-id") ??
      (await headers()).get("cf-ray") ??
      undefined;
    await recordCurrentPolicyAcceptances(
      data.user.id,
      "signup",
      signupRequestId,
    ).catch(() => undefined);
    await recordSignupMarketingChoice(
      data.user.id,
      marketingConsent,
      signupRequestId,
    );

    const { error: setupError } = await ensureMarketplaceAccount(supabase);
    if (setupError) return { message: "Your account was created, but setup could not finish. Sign in to retry." };
    redirect(getMarketplaceRedirect(requestedRedirect));
  }

  return {
    message: "Account setup could not finish. Try signing in with your email and password.",
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(SIGN_OUT_REDIRECT_PATH);
}

export async function requestPasswordResetAction(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rateLimitError = await checkAuthRateLimit("password-reset-request");
  if (rateLimitError) return rateLimitError;

  const parsed = passwordResetRequestSchema.safeParse({
    email: formData.get("email"),
  });
  const origin = String(formData.get("origin") ?? "");

  if (!parsed.success) {
    return { message: firstSchemaError(parsed.error) };
  }

  const turnstileError = await checkTurnstile(formData);
  if (turnstileError) {
    return { message: turnstileError };
  }

  const supabase = await createClient();
  const baseOrigin = origin || (await resolveRequestOrigin());
  // Supabase's recovery link lands on the callback, which routes password
  // recovery sessions to the reset form regardless of role.
  const redirectTo = `${baseOrigin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`;

  // Ignore the result: resetPasswordForEmail does not reveal whether the
  // account exists, preserving anti-enumeration.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });

  return {
    success: true,
    message: PASSWORD_RESET_SUCCESS_MESSAGE,
  };
}

export async function updatePasswordAction(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rateLimitError = await checkAuthRateLimit("password-update");
  if (rateLimitError) return rateLimitError;

  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { message: firstSchemaError(parsed.error) };
  }

  // The recovery link established a session via the callback; updateUser applies
  // the new password to that authenticated (recovery) session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: PASSWORD_RESET_INVALID_MESSAGE };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    logger.warn("Password update failed", { userId: user.id, error });
    return { message: PASSWORD_RESET_INVALID_MESSAGE };
  }

  logger.info("Audit password reset", {
    audit: true,
    actorId: user.id,
    action: "password_reset",
  });

  redirect("/auth?reset=complete");
}
