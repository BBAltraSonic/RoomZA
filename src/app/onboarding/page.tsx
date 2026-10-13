import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminMembership } from "@/features/admin/auth";
import { requireUser } from "@/lib/auth";
import { getMarketplaceRedirect } from "@/lib/redirects";

export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };

/** Compatibility entry point for old signup and onboarding links. */
export default async function OnboardingPage({ searchParams }: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const [{ user }, params] = await Promise.all([
    requireUser({ redirectTo: "/onboarding" }), searchParams,
  ]);
  if (!params.redirect && await getAdminMembership(user.id)) redirect("/admin");
  redirect(getMarketplaceRedirect(params.redirect));
}
