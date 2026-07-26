import type { Metadata } from "next";

import { PageHeader } from "@/components/premium/primitives";
import { getAccountSecuritySettings } from "@/features/trust/account-security-data";
import { SettingsConsole } from "@/features/trust/components/settings-console";
import { getTrustSettingsData } from "@/features/trust/settings-data";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const { user, profile } = await requireUser({ redirectTo: "/settings" });
  const [data, security] = await Promise.all([
    getTrustSettingsData(user.id),
    getAccountSecuritySettings(user),
  ]);
  const availabilityMode =
    profile?.availability_mode === "available" ||
    profile?.availability_mode === "busy" ||
    profile?.availability_mode === "invisible"
      ? profile.availability_mode
      : "auto";
  return <main className="min-h-dvh bg-background px-4 pb-28 pt-16 text-foreground sm:px-6 lg:pt-20"><div className="mx-auto max-w-6xl"><PageHeader eyebrow="Account controls" title="Settings" description="Manage your profile, privacy, notifications, sign-in methods, and reports." /><SettingsConsole email={profile?.email ?? user.email ?? ""} availabilityMode={availabilityMode} identities={security.identities} mfaFactors={security.mfaFactors} sessions={security.sessions} initialPreferences={data.preferences} privacyRequests={data.privacyRequests} reports={data.reports} /></div></main>;
}
