import { redirect } from "next/navigation";

import { getUserMfaChallengeData } from "@/features/trust/account-security-data";
import { UserMfaChallenge } from "@/features/trust/components/user-mfa-challenge";
import { safeRedirectPath } from "@/lib/redirects";

export default async function UserMfaPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const redirectTo = safeRedirectPath((await searchParams).redirect, "/");
  const data = await getUserMfaChallengeData();
  if (!data.authenticated) redirect(`/auth?redirect=${encodeURIComponent(redirectTo)}`);
  if (!data.factors.length) redirect(redirectTo);
  return <main className="min-h-dvh bg-background px-4 py-16 text-foreground"><UserMfaChallenge factors={data.factors} redirectTo={redirectTo} /></main>;
}
