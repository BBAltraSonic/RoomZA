"use server";

import { AuthApiError } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { EMAIL_VERIFICATION_SENT_MESSAGE } from "@/features/auth/email-verification";
import { requestEmailVerificationByEmail, requestEmailVerificationForUser } from "@/features/auth/email-verification-store";
import { SIGN_OUT_REDIRECT_PATH } from "@/features/auth/sign-out";
import { LOGIN_FAILURE_MESSAGE } from "@/features/auth/login-lockout";
import { clearLoginFailures, readLoginLockout, recordFailedLogin } from "@/features/auth/login-lockout-store";
import { PASSWORD_RESET_INVALID_MESSAGE, PASSWORD_RESET_SUCCESS_MESSAGE } from "@/features/auth/password-reset";
import { consumePasswordResetToken, requestPasswordReset } from "@/features/auth/password-reset-store";
import { authCredentialsSchema, firstSchemaError, passwordResetRequestSchema, updatePasswordSchema } from "@/features/auth/schemas";
import { authCookieOptions, isSupabaseAuthCookie } from "@/features/auth/session-persistence";
import { isRole } from "@/lib/roles";
import { emailVerificationPathForRedirect, getRoleAwareRedirect, onboardingPathForRedirect, safeRedirectPath } from "@/lib/redirects";
import { AUTH_RATE_LIMIT, consumeRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { logger } from "@/lib/logger";

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
  if (!process.env.TURNSTILE_SECRET_KEY && process.env.NODE_ENV !== "production") return null;

  const token = formData.get("cf-turnstile-response");
  const hdrs = await headers();
  const ip = getClientIpFromHeaders(hdrs);

  const ok = await verifyTurnstileToken(typeof token === "string" ? token : null, ip);
  return ok ? null : "Verification failed. Please try again.";
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof AuthApiError) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
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

export async function signInAction(_state: AuthState, formData: FormData): Promise<AuthState> {
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

  const { data: profile } = await supabase.from("profiles").select("role,email_verified_at").eq("id", user.id).maybeSingle();

  logger.info("Audit login", {
    audit: true,
    actorId: user.id,
    action: "login",
    role: profile?.role ?? null,
  });

  if (!profile?.email_verified_at) {
    redirect(emailVerificationPathForRedirect(requestedRedirect));
  }

  redirect(isRole(profile?.role) ? getRoleAwareRedirect(profile.role, requestedRedirect) : onboardingPathForRedirect(requestedRedirect));
}

export async function signUpAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const rateLimitError = await checkAuthRateLimit("sign-up");
  if (rateLimitError) return rateLimitError;

  const credentials = authCredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const requestedRedirect = safeRedirectPath(formData.get("redirect"), "/");

  if (!credentials.success) {
    return { message: firstSchemaError(credentials.error) };
  }

  const turnstileError = await checkTurnstile(formData);
  if (turnstileError) {
    return { message: turnstileError };
  }

  const supabase = await createClient();
  const origin = String(formData.get("origin") ?? "");

  const { data, error } = await supabase.auth.signUp({
    ...credentials.data,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(requestedRedirect)}`,
    },
  });

  if (error) {
    return { message: getAuthErrorMessage(error) };
  }

  if (data.user) {
    const { data: profile } = await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        email: data.user.email ?? credentials.data.email,
        email_verified_at: null,
      },
      { onConflict: "id" },
    ).select("role,email_verified_at").single();

    await requestEmailVerificationForUser(data.user.id, data.user.email ?? credentials.data.email, requestedRedirect);

    if (data.session) {
      if (profile?.email_verified_at) {
        redirect(isRole(profile?.role) ? getRoleAwareRedirect(profile.role, requestedRedirect) : onboardingPathForRedirect(requestedRedirect));
      }
      redirect(emailVerificationPathForRedirect(requestedRedirect, "sent"));
    }
  }

  return {
    success: true,
    message: EMAIL_VERIFICATION_SENT_MESSAGE,
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(SIGN_OUT_REDIRECT_PATH);
}

export async function requestPasswordResetAction(_state: AuthState, formData: FormData): Promise<AuthState> {
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

  await requestPasswordReset(parsed.data.email, origin);

  return {
    success: true,
    message: PASSWORD_RESET_SUCCESS_MESSAGE,
  };
}

export async function resendEmailVerificationAction(formData: FormData) {
  const parsed = passwordResetRequestSchema.safeParse({
    email: formData.get("email"),
  });
  const requestedRedirect = safeRedirectPath(formData.get("redirect"), "/");
  const rateLimitError = await checkAuthRateLimit("email-verification-resend");

  if (rateLimitError) {
    redirect(emailVerificationPathForRedirect(requestedRedirect, "rate-limited"));
  }

  if (parsed.success) {
    await requestEmailVerificationByEmail(parsed.data.email, requestedRedirect);
  }

  redirect(emailVerificationPathForRedirect(requestedRedirect, "sent"));
}

export async function updatePasswordAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const rateLimitError = await checkAuthRateLimit("password-update");
  if (rateLimitError) return rateLimitError;

  const parsed = updatePasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { message: firstSchemaError(parsed.error) };
  }

  const result = await consumePasswordResetToken(parsed.data.token, parsed.data.password);

  if (!result.ok) {
    return { message: PASSWORD_RESET_INVALID_MESSAGE };
  }

  redirect("/auth?reset=complete");
}
