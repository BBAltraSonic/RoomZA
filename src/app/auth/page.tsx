import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/app/auth/auth-form";
import { safeRedirectPath } from "@/lib/redirects";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in or create your Pinpoints account.",
  robots: { index: false, follow: false },
};

type AuthPageProps = {
  searchParams: Promise<{
    error?: string;
    redirect?: string;
    reset?: string;
    verified?: string;
  }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const redirectPath = safeRedirectPath(params.redirect, "/");
  const message = params.error === "callback"
    ? { tone: "error" as const, text: "Authentication failed. Please sign in again." }
    : params.reset === "complete"
      ? { tone: "success" as const, text: "Password updated. Sign in with your new password." }
      : params.verified === "complete"
        ? { tone: "success" as const, text: "Email verified. Sign in to continue." }
      : null;

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <Link
          className="mb-8 inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border border-border bg-panel px-3 text-sm font-medium text-ink transition-colors hover:bg-warm-surface"
          href="/"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" aria-hidden="true" width={16} height={16} className="size-4" />
          Pinpoints
        </Link>
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase text-clay">Account access</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">
            Continue to Pinpoints
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Use one account for applications, saved homes, messages, and listing management.
          </p>
        </div>
        {message ? (
          <p
            className={
              message.tone === "success"
                ? "mb-4 rounded-md border border-forest/30 bg-forest/5 px-3 py-2 text-sm text-forest"
                : "mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            }
            role={message.tone === "success" ? "status" : "alert"}
          >
            {message.text}
          </p>
        ) : null}
        <AuthForm redirectPath={redirectPath} />
      </div>
    </main>
  );
}
