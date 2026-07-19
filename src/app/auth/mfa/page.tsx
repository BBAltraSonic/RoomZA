import { redirect } from "next/navigation";

import { UserMfaChallenge } from "@/features/trust/components/user-mfa-challenge";
import { safeRedirectPath } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

export default async function UserMfaPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const redirectTo = safeRedirectPath((await searchParams).redirect, "/");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=${encodeURIComponent(redirectTo)}`);
  const { data } = await supabase.auth.mfa.listFactors();
  const factors = data?.totp.filter((factor) => factor.status === "verified").map((factor) => ({ id: factor.id, friendlyName: factor.friendly_name ?? null })) ?? [];
  if (!factors.length) redirect(redirectTo);
  return <main className="min-h-dvh bg-background px-4 py-16 text-foreground"><UserMfaChallenge factors={factors} redirectTo={redirectTo} /></main>;
}
