import type { Metadata } from "next";

import { PageHeader } from "@/components/premium/primitives";
import { SettingsConsole } from "@/features/trust/components/settings-console";
import { getTrustSettingsData } from "@/features/trust/settings-data";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const { user, profile } = await requireUser({ redirectTo: "/settings" });
  const data = await getTrustSettingsData(user.id);
  const supabase = await createClient();
  const [{ data: factors }, { data: sessions }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.rpc("get_my_auth_sessions"),
  ]);
  const verifiedFactors = factors?.totp.filter((factor) => factor.status === "verified").map((factor) => ({ id: factor.id, friendlyName: factor.friendly_name ?? null })) ?? [];
  const identities = (user.identities ?? []).map((identity) => ({ id: identity.id, provider: identity.provider, email: typeof identity.identity_data?.email === "string" ? identity.identity_data.email : user.email ?? null, lastSignInAt: identity.last_sign_in_at ?? null }));
  return <main className="min-h-dvh bg-background px-4 pb-28 pt-16 text-foreground sm:px-6 lg:pt-20"><div className="mx-auto max-w-6xl"><PageHeader eyebrow="Account controls" title="Settings" description="Manage your profile, privacy, notifications, sign-in methods, and reports." /><SettingsConsole email={profile?.email ?? user.email ?? ""} identities={identities} mfaFactors={verifiedFactors} sessions={(sessions ?? []).map((session) => ({ id: session.id, createdAt: session.created_at, updatedAt: session.updated_at, userAgent: session.user_agent, isCurrent: session.is_current }))} initialPreferences={data.preferences} privacyRequests={data.privacyRequests} reports={data.reports} /></div></main>;
}
