"use server";

import { AuthApiError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getRoleHome, isRole } from "@/lib/roles";
import { getRoleAwareRedirect, onboardingPathForRedirect, safeRedirectPath } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstileToken } from "@/lib/turnstile";

type AuthState = {
  message?: string;
  /** When true, the message is informational/success rather than an error. */
  success?: boolean;
};

/**
 * Verifies the Turnstile token from an auth form submission.
 * Only enforced when TURNSTILE_SECRET_KEY is configured, so environments
 * without Turnstile set up are never blocked from signing in.
 * Returns an error message string when verification fails, otherwise null.
 */
async function checkTurnstile(formData: FormData): Promise<string | null> {
  if (!process.env.TURNSTILE_SECRET_KEY) return null;

  const token = formData.get("cf-turnstile-response");
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("cf-connecting-ip") || undefined;

  const ok = await verifyTurnstileToken(typeof token === "string" ? token : null, ip);
  return ok ? null : "Verification failed. Please try again.";
}

function getCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  return { email, password };
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof AuthApiError) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export async function signInAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const credentials = getCredentials(formData);
  const requestedRedirect = safeRedirectPath(formData.get("redirect"), "/");

  if ("error" in credentials) {
    return { message: credentials.error };
  }

  const turnstileError = await checkTurnstile(formData);
  if (turnstileError) {
    return { message: turnstileError };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return { message: getAuthErrorMessage(error) };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  redirect(isRole(profile?.role) ? getRoleAwareRedirect(profile.role, requestedRedirect) : onboardingPathForRedirect(requestedRedirect));
}

export async function signUpAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const credentials = getCredentials(formData);
  const requestedRedirect = safeRedirectPath(formData.get("redirect"), "/");

  if ("error" in credentials) {
    return { message: credentials.error };
  }

  const turnstileError = await checkTurnstile(formData);
  if (turnstileError) {
    return { message: turnstileError };
  }

  const supabase = await createClient();
  const origin = String(formData.get("origin") ?? "");

  const { data, error } = await supabase.auth.signUp({
    ...credentials,
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
        email: data.user.email ?? credentials.email,
      },
      { onConflict: "id" },
    ).select("role").single();

    if (data.session) {
      redirect(isRole(profile?.role) ? getRoleAwareRedirect(profile.role, requestedRedirect) : onboardingPathForRedirect(requestedRedirect));
    }
  }

  // No session means Supabase requires email confirmation before sign-in.
  return {
    success: true,
    message: "Check your inbox — we sent a confirmation link to verify your email. Confirm it, then sign in.",
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth");
}

export async function requestPasswordResetAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const origin = String(formData.get("origin") ?? "");

  if (!email) {
    return { message: "Enter the email address linked to your account." };
  }

  const turnstileError = await checkTurnstile(formData);
  if (turnstileError) {
    return { message: turnstileError };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
  });

  if (error) {
    return { message: getAuthErrorMessage(error) };
  }

  // Always return success to avoid leaking whether an account exists.
  return {
    success: true,
    message: "If an account exists for that email, a password reset link is on its way.",
  };
}

export async function updatePasswordAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 6) {
    return { message: "Password must be at least 6 characters." };
  }

  if (password !== confirmPassword) {
    return { message: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "Your reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { message: getAuthErrorMessage(error) };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  redirect(isRole(profile?.role) ? getRoleHome(profile.role) : "/onboarding");
}
