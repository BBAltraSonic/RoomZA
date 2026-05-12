import type { Metadata } from "next";
import { Building2, Home, KeyRound } from "lucide-react";
import { redirect } from "next/navigation";

import { chooseRoleAction } from "@/app/onboarding/actions";
import { requireUser } from "@/lib/auth";
import { getRoleHome, isRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Choose Your Role",
  robots: { index: false, follow: false },
};

type OnboardingPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const [{ profile }, params] = await Promise.all([requireUser(), searchParams]);

  if (isRole(profile?.role)) {
    redirect(getRoleHome(profile.role));
  }

  const error = params.error;

  return (
    <main className="min-h-screen bg-[#f5f3ee] px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col justify-center">
        <div className="mb-8">
          <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-[#24463f] text-white">
            <KeyRound className="size-5" />
          </div>
          <p className="text-sm font-medium text-[#2d5b52]">Role setup</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Choose how you want to use RoomZA</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            This unlocks the right workspace for your account. You can update richer profile details later.
          </p>
          {error ? (
            <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              We could not save that role. Please try again.
            </p>
          ) : null}
        </div>

        <form action={chooseRoleAction} className="grid gap-4 md:grid-cols-2">
          <button
            className="rounded-lg border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#2d5b52]"
            name="role"
            type="submit"
            value="renter"
          >
            <Home className="mb-5 size-6 text-[#2d5b52]" />
            <h2 className="text-xl font-semibold">I rent homes</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Track applications, verified inquiries, documents, and viewing slots.
            </p>
          </button>

          <button
            className="rounded-lg border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#2d5b52]"
            name="role"
            type="submit"
            value="landlord"
          >
            <Building2 className="mb-5 size-6 text-[#b86f42]" />
            <h2 className="text-xl font-semibold">I manage listings</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create listings, review applicants, shortlist renters, and propose viewings.
            </p>
          </button>
        </form>
      </div>
    </main>
  );
}
