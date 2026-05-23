"use server";

import { AuthApiError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { getRoleHome, isRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

type AuthState = {
  message?: string;
};

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

  if ("error" in credentials) {
    return { message: credentials.error };
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

  redirect(isRole(profile?.role) ? getRoleHome(profile.role) : "/onboarding");
}

export async function signUpAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const credentials = getCredentials(formData);

  if ("error" in credentials) {
    return { message: credentials.error };
  }

  const supabase = await createClient();
  const origin = String(formData.get("origin") ?? "");

  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { message: getAuthErrorMessage(error) };
  }

  if (data.user) {
    await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        email: data.user.email ?? credentials.email,
      },
      { onConflict: "id" },
    );
  }

  return {
    message: "Check your email to confirm your RoomZA account.",
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth");
}
