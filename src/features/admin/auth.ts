import "server-only";

import { redirect } from "next/navigation";

import { authPathForRedirect, emailVerificationPathForRedirect } from "@/lib/redirects";
import { createUntypedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import type { AdminContext, AdminLevel, AdminMembership } from "./types";
import { adminMfaDestination, requiredAdminFactors } from "./policy";

function isAdminLevel(value: unknown): value is AdminLevel {
  return value === "owner" || value === "admin";
}

export async function getAdminMembership(userId: string): Promise<AdminMembership | null> {
  const admin = createUntypedClient();
  const { data, error } = await admin
    .from("admin_memberships")
    .select("user_id, level, invited_by, created_at, updated_at, revoked_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data || !isAdminLevel(data.level)) return null;
  return data as AdminMembership;
}

async function hasActiveSuspension(userId: string) {
  const admin = createUntypedClient();
  const { data } = await admin
    .from("account_suspensions")
    .select("id, suspended_until")
    .eq("user_id", userId)
    .is("restored_at", null)
    .maybeSingle();

  if (!data) return false;
  return !data.suspended_until || new Date(data.suspended_until).getTime() > Date.now();
}

export async function requireAdminMembership(options: { redirectTo?: string } = {}): Promise<AdminContext> {
  const redirectTo = options.redirectTo ?? "/admin";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(authPathForRedirect(redirectTo));

  const membership = await getAdminMembership(user.id);
  if (!membership) redirect("/");

  if (await hasActiveSuspension(user.id)) redirect("/account-suspended");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.email_verified_at && !user.email_confirmed_at) {
    redirect(emailVerificationPathForRedirect(redirectTo));
  }

  const [{ data: factors }, { data: assurance }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const verifiedFactorCount = factors?.totp.filter((factor) => factor.status === "verified").length ?? 0;

  return {
    user: { id: user.id, email: user.email },
    membership,
    verifiedFactorCount,
    assuranceLevel: assurance?.currentLevel ?? null,
  };
}

export async function requireAdmin(options: { ownerOnly?: boolean; redirectTo?: string } = {}) {
  const context = await requireAdminMembership(options);
  const mfaDestination = adminMfaDestination({ level: context.membership.level, verifiedFactors: context.verifiedFactorCount, assuranceLevel: context.assuranceLevel });
  if (mfaDestination) redirect(mfaDestination);
  if (options.ownerOnly && context.membership.level !== "owner") redirect("/admin");

  return context;
}

export async function getCurrentAdminMembership() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? getAdminMembership(user.id) : null;
}

export async function getAdminMfaChallengeData() {
  const context = await requireAdminMembership({ redirectTo: "/admin/security/mfa/challenge" });
  const required = requiredAdminFactors(context.membership.level);
  if (context.verifiedFactorCount < required) redirect("/admin/security/mfa/setup");
  if (context.assuranceLevel === "aal2") redirect("/admin");
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp.filter((factor) => factor.status === "verified").map((factor) => ({ id: factor.id, friendly_name: factor.friendly_name })) ?? [];
}
