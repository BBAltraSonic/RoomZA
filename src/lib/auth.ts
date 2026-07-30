import { redirect } from "next/navigation";

import type { Role } from "@/lib/roles";
import { getPersonaHome, type MarketplacePersona } from "@/lib/personas";
import {
  authPathForRedirect,
  emailVerificationPathForRedirect,
  onboardingPathForRedirect,
} from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";
import { createUntypedClient } from "@/lib/supabase/admin";
import { getRequiredPolicyVersions } from "@/features/trust/acceptance";

const SESSION_PROFILE_COLUMNS =
  "id,email,role,created_at,updated_at,phone,phone_verified,email_verified_at,full_name,avatar_url,about,presence_status,availability_mode" as const;

async function hasActiveAccountSuspension(userId: string) {
  const admin = createUntypedClient();
  const { data } = await admin
    .from("account_suspensions")
    .select("suspended_until")
    .eq("user_id", userId)
    .is("restored_at", null)
    .maybeSingle();
  return Boolean(
    data &&
    (!data.suspended_until || new Date(data.suspended_until) > new Date()),
  );
}

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null, personas: [] };
  }

  const [{ data: profile }, { data: personaRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select(SESSION_PROFILE_COLUMNS)
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_personas")
      .select("persona,is_primary,is_active")
      .eq("profile_id", user.id)
      .order("created_at"),
  ]);

  const personas = personaRows ?? [];

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
      .select(SESSION_PROFILE_COLUMNS)
      .single();

    const { data: createdPersonas } = await supabase
      .from("profile_personas")
      .select("persona,is_primary,is_active")
      .eq("profile_id", user.id)
      .order("created_at");
    return { user, profile: createdProfile, personas: createdPersonas ?? [] };
  }

  // Keep the app's verification gate in sync with Supabase Auth. Email
  // confirmation is owned by Supabase now, so if the auth user is confirmed but
  // the profile marker is stale, backfill it once instead of gating forever.
  if (!profile.email_verified_at && user.email_confirmed_at) {
    const verifiedAt = user.email_confirmed_at;
    const { data: syncedProfile } = await supabase
      .from("profiles")
      .update({
        email_verified_at: verifiedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select(SESSION_PROFILE_COLUMNS)
      .single();

    if (syncedProfile) {
      return { user, profile: syncedProfile, personas };
    }
  }

  return { user, profile, personas };
}

export async function requireUser(options?: { redirectTo?: string }) {
  const session = await getSessionProfile();

  if (!session.user) {
    redirect(authPathForRedirect(options?.redirectTo ?? "/"));
  }

  if (await hasActiveAccountSuspension(session.user.id)) {
    redirect("/account-suspended");
  }

  if (
    options?.redirectTo !== "/policy-acceptance" &&
    (await getRequiredPolicyVersions(session.user.id)).length
  ) {
    redirect("/policy-acceptance");
  }

  return session as Awaited<ReturnType<typeof getSessionProfile>> & {
    user: NonNullable<Awaited<ReturnType<typeof getSessionProfile>>["user"]>;
  };
}

export async function requireRole(
  requiredRole: Role,
  options?: { redirectTo?: string },
) {
  return requirePersona(requiredRole, options);
}

export async function requirePersona(
  requiredPersona: MarketplacePersona,
  options?: { redirectTo?: string },
) {
  const session = await requireUser(options);
  const requestedPath = options?.redirectTo ?? getPersonaHome(requiredPersona);

  if (!session.profile?.email_verified_at) {
    redirect(emailVerificationPathForRedirect(requestedPath));
  }

  if (!session.personas.length) {
    redirect(onboardingPathForRedirect(requestedPath));
  }

  if (!session.personas.some(({ persona }) => persona === requiredPersona)) {
    const active = session.personas.find(({ is_active }) => is_active)?.persona;
    redirect(active ? getPersonaHome(active) : "/profile");
  }

  return session as typeof session & {
    profile: NonNullable<typeof session.profile>;
    personas: Array<{
      persona: MarketplacePersona;
      is_primary: boolean;
      is_active: boolean;
    }>;
  };
}

export async function requireAnyPersona(
  allowedPersonas: readonly MarketplacePersona[],
  options?: { redirectTo?: string },
) {
  const session = await requireUser(options);
  const requestedPath = options?.redirectTo ?? "/profile";

  if (!session.profile?.email_verified_at) {
    redirect(emailVerificationPathForRedirect(requestedPath));
  }

  if (!session.personas.length) {
    redirect(onboardingPathForRedirect(requestedPath));
  }

  if (
    !session.personas.some(({ persona }) => allowedPersonas.includes(persona))
  ) {
    const active = session.personas.find(({ is_active }) => is_active)?.persona;
    redirect(active ? getPersonaHome(active) : "/profile");
  }

  return session as typeof session & {
    profile: NonNullable<typeof session.profile>;
    personas: Array<{
      persona: MarketplacePersona;
      is_primary: boolean;
      is_active: boolean;
    }>;
  };
}
