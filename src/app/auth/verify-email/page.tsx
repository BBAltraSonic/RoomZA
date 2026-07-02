import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck, RefreshCcw } from "lucide-react";
import { redirect } from "next/navigation";

import { resendEmailVerificationAction } from "@/app/auth/verify-email/actions";
import { Button } from "@/components/ui/button";
import { EMAIL_VERIFICATION_INVALID_MESSAGE, EMAIL_VERIFICATION_SENT_MESSAGE } from "@/features/auth/email-verification";
import { consumeEmailVerificationToken } from "@/features/auth/email-verification-store";
import { getSessionProfile } from "@/lib/auth";
import { authPathForRedirect, getRoleAwareRedirect, onboardingPathForRedirect, safeRedirectPath } from "@/lib/redirects";
import { isRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Verify Email",
  robots: { index: false, follow: false },
};

type VerifyEmailPageProps = {
  searchParams: Promise<{
    email?: string;
    redirect?: string;
    status?: string;
    token?: string;
  }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams;
  const redirectPath = safeRedirectPath(params.redirect, "/");
  const token = typeof params.token === "string" ? params.token : "";

  if (token) {
    const result = await consumeEmailVerificationToken(token);

    if (result.ok) {
      const { user, profile } = await getSessionProfile();

      if (user?.id === result.userId) {
        redirect(isRole(profile?.role) ? getRoleAwareRedirect(profile.role, redirectPath) : onboardingPathForRedirect(redirectPath));
      }

      redirect(authPathForRedirect(onboardingPathForRedirect(redirectPath)) + "&verified=complete");
    }
  }

  const isSent = params.status === "sent";
  const isRateLimited = params.status === "rate-limited";
  const isEmptyState = !token && !isSent && !isRateLimited;
  const statusMessage = isSent
    ? EMAIL_VERIFICATION_SENT_MESSAGE
    : isRateLimited
      ? "Too many verification requests. Try again later."
      : EMAIL_VERIFICATION_INVALID_MESSAGE;
  const email = typeof params.email === "string" ? params.email : "";

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <Link
          className="mb-8 inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border border-border bg-panel px-3 text-sm font-medium text-ink transition-colors hover:bg-warm-surface"
          href="/"
        >
          RoomZA
        </Link>

        <div className="rounded-lg border border-border bg-panel p-5 shadow-[var(--elevation-2)]">
          <div className="mb-5 flex size-10 items-center justify-center rounded-md bg-forest text-primary-foreground">
            <MailCheck className="size-5" />
          </div>
          <p className="text-xs font-semibold uppercase text-clay">Email verification</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-ink">
            {isSent ? "Check your inbox" : "Verify your email"}
          </h1>
          <p
            className="mt-3 text-sm leading-6 text-muted-foreground"
            data-empty-state={isEmptyState ? "true" : undefined}
            role={isSent ? "status" : "alert"}
          >
            {statusMessage}
          </p>

          <form action={resendEmailVerificationAction} className="mt-5 grid gap-4">
            <input name="redirect" type="hidden" value={redirectPath} />
            <label className="grid gap-1.5 text-sm font-medium text-ink">
              Email
              <input
                className="h-11 rounded-md border border-input bg-warm-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest"
                defaultValue={email}
                name="email"
                placeholder="you@example.com"
                required
                type="email"
              />
            </label>
            <Button className="h-11 bg-forest text-primary-foreground hover:bg-forest/90" type="submit">
              <RefreshCcw className="mr-2 size-4" />
              Send verification link
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
