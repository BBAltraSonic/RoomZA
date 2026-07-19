import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { redirect } from "next/navigation";

import { getAdminMembership } from "@/features/admin/auth";
import { RoleChoiceForm } from "@/features/onboarding/role-choice-form";
import { requireUser } from "@/lib/auth";
import { emailVerificationPathForRedirect, getRoleAwareRedirect, safeRedirectPath } from "@/lib/redirects";
import { isRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Choose Your Role",
  robots: { index: false, follow: false },
};

type OnboardingPageProps = {
  searchParams: Promise<{
    error?: string;
    redirect?: string;
  }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const [{ user, profile }, params] = await Promise.all([requireUser(), searchParams]);
  const redirectPath = params.redirect ? safeRedirectPath(params.redirect, "/") : undefined;

  if (await getAdminMembership(user.id)) {
    redirect("/admin");
  }

  if (isRole(profile?.role)) {
    redirect(getRoleAwareRedirect(profile.role, redirectPath));
  }

  if (!profile?.email_verified_at) {
    redirect(emailVerificationPathForRedirect(redirectPath ?? "/"));
  }

  const error = params.error;

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-4xl flex-col justify-center">
        <div className="mb-8 max-w-2xl">
          <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-forest text-primary-foreground">
            <KeyRound className="size-5" />
          </div>
          <p className="text-xs font-semibold uppercase text-clay">Choose a workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">
            What brings you to Pinpoints?
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Pick the workflow you need now. This choice controls the actions available in your workspace.
          </p>
          {error ? (
            <p className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              We could not save that role. Please try again.
            </p>
          ) : null}
        </div>

        <RoleChoiceForm redirectPath={redirectPath} />
      </div>
    </main>
  );
}
