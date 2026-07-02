import type { Metadata } from "next";
import { Building2, CheckCircle2, Home, KeyRound } from "lucide-react";
import { redirect } from "next/navigation";

import { chooseRoleAction } from "@/app/onboarding/actions";
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

const roleCards = [
  {
    value: "renter",
    icon: Home,
    title: "I rent homes",
    description: "Discover homes on the map, apply with documents, manage viewing slots, and keep messages organized.",
    steps: ["Save homes", "Apply once ready", "Track responses"],
  },
  {
    value: "landlord",
    icon: Building2,
    title: "I manage listings",
    description: "Create structured listings, review applications, shortlist renters, and propose viewing times.",
    steps: ["Publish listings", "Review applicants", "Book viewings"],
  },
];

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const [{ profile }, params] = await Promise.all([requireUser(), searchParams]);
  const redirectPath = safeRedirectPath(params.redirect, "/");

  if (isRole(profile?.role)) {
    redirect(getRoleAwareRedirect(profile.role, redirectPath));
  }

  if (!profile?.email_verified_at) {
    redirect(emailVerificationPathForRedirect(redirectPath));
  }

  const error = params.error;

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-4xl flex-col justify-center">
        <div className="mb-8 max-w-2xl">
          <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-forest text-primary-foreground">
            <KeyRound className="size-5" />
          </div>
          <p className="text-xs font-semibold uppercase text-clay">Role setup</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">
            Choose your RoomZA workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your role controls the first screen you see and the workflow actions available to you.
          </p>
          {error ? (
            <p className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              We could not save that role. Please try again.
            </p>
          ) : null}
        </div>

        <form action={chooseRoleAction} className="grid gap-4 md:grid-cols-2">
          <input name="redirect" type="hidden" value={redirectPath} />
          {roleCards.map((role) => {
            const Icon = role.icon;

            return (
              <button
                key={role.value}
                className="rounded-lg border border-border bg-panel p-5 text-left shadow-[var(--elevation-1)] transition-colors hover:border-forest/35 hover:bg-warm-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                name="role"
                type="submit"
                value={role.value}
              >
                <Icon className="mb-5 size-6 text-forest" />
                <h2 className="text-xl font-semibold text-ink">{role.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{role.description}</p>
                <div className="mt-5 grid gap-2">
                  {role.steps.map((step) => (
                    <span key={step} className="inline-flex items-center gap-2 text-sm font-medium text-ink">
                      <CheckCircle2 className="size-4 text-forest" />
                      {step}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </form>
      </div>
    </main>
  );
}
