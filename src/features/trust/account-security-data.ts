import "server-only";

import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

export async function getUserMfaChallengeData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { authenticated: false as const, factors: [] };

  const { data } = await supabase.auth.mfa.listFactors();
  const factors =
    data?.totp
      .filter((factor) => factor.status === "verified")
      .map((factor) => ({
        id: factor.id,
        friendlyName: factor.friendly_name ?? null,
      })) ?? [];

  return { authenticated: true as const, factors };
}

export async function getAccountSecuritySettings(user: User) {
  const supabase = await createClient();
  const [{ data: factors }, { data: sessions }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.rpc("get_my_auth_sessions"),
  ]);

  return {
    mfaFactors:
      factors?.totp
        .filter((factor) => factor.status === "verified")
        .map((factor) => ({
          id: factor.id,
          friendlyName: factor.friendly_name ?? null,
        })) ?? [],
    identities: (user.identities ?? []).map((identity) => ({
      id: identity.id,
      provider: identity.provider,
      email:
        typeof identity.identity_data?.email === "string"
          ? identity.identity_data.email
          : user.email ?? null,
      lastSignInAt: identity.last_sign_in_at ?? null,
    })),
    sessions: (sessions ?? []).map((session) => ({
      id: session.id,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      userAgent: session.user_agent,
      isCurrent: session.is_current,
    })),
  };
}
