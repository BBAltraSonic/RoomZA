import type { Metadata } from "next";
import { LogOut, Mail, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/auth/actions";
import { ProfileForm } from "@/app/profile/profile-form";
import { PageHeader, StatusBadge } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { PresenceBadge } from "@/features/presence/presence-badge";

export const metadata: Metadata = {
  title: "Your Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const { profile } = await requireUser({ redirectTo: "/profile" });
  if (!profile) redirect("/onboarding");

  return (
    <main
      className="min-h-dvh bg-background px-4 pb-[calc(var(--mobile-bottom-nav-h)+var(--mobile-safe-bottom)+1rem)] text-foreground sm:px-6 sm:pb-28 sm:pt-20"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)" }}
    >
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="Account settings"
          title="Profile"
          description="Keep your contact details ready for applications, viewings, and landlord coordination."
          action={
            <form action={signOutAction}>
              <Button type="submit" variant="outline" className="h-10 border-border bg-panel text-muted-foreground hover:bg-rose-50 hover:text-destructive">
                <LogOut className="size-4" />
                Sign out
              </Button>
            </form>
          }
        />

        <section className="rounded-2xl border border-border bg-panel p-5 shadow-[var(--elevation-1)] sm:rounded-lg">
          <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-warm-surface">
                <Mail className="size-4 text-forest" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Email address</p>
                <p className="truncate text-sm font-semibold text-ink">{profile.email}</p>
                <PresenceBadge
                  badge={
                    profile.presence_status === "available" || profile.presence_status === "busy"
                      ? profile.presence_status
                      : "offline"
                  }
                  className="mt-1"
                />
              </div>
            </div>
            <StatusBadge tone={profile.role === "landlord" ? "clay" : "forest"}>
              <ShieldCheck className="size-3.5" />
              {profile.role || "No role"}
            </StatusBadge>
          </div>

          <div>
            <h2 className="text-lg font-semibold tracking-normal text-ink">Contact details</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              This number is used to coordinate viewings and lease steps.
            </p>

            <ProfileForm currentPhone={profile.phone} phoneVerified={profile.phone_verified} />
          </div>
        </section>
      </div>
    </main>
  );
}
