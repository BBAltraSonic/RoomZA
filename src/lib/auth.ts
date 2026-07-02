import { redirect } from "next/navigation";

import { getRoleHome, isRole, type Role } from "@/lib/roles";
import { authPathForRedirect, emailVerificationPathForRedirect, getRoleAwareRedirect, onboardingPathForRedirect } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (!profile) {
    const { data: createdProfile } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? "",
          email_verified_at: user.email_confirmed_at ?? null,
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    return { user, profile: createdProfile };
  }

  return { user, profile };
}

export async function requireUser(options?: { redirectTo?: string }) {
  const session = await getSessionProfile();

  if (!session.user) {
    redirect(authPathForRedirect(options?.redirectTo ?? "/"));
  }

  return session as Awaited<ReturnType<typeof getSessionProfile>> & {
    user: NonNullable<Awaited<ReturnType<typeof getSessionProfile>>["user"]>;
  };
}

export async function requireRole(requiredRole: Role, options?: { redirectTo?: string }) {
  const session = await requireUser(options);
  const requestedPath = options?.redirectTo ?? getRoleHome(requiredRole);

  if (!session.profile?.email_verified_at) {
    redirect(emailVerificationPathForRedirect(requestedPath));
  }

  if (!isRole(session.profile?.role)) {
    redirect(onboardingPathForRedirect(requestedPath));
  }

  if (session.profile.role !== requiredRole) {
    redirect(getRoleAwareRedirect(session.profile.role, requestedPath));
  }

  return session as typeof session & {
    profile: NonNullable<typeof session.profile> & { role: Role };
  };
}
