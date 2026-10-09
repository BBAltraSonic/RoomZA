import type { Metadata } from "next";
import Link from "next/link";
import chrome from "@/components/navigation/pinpoint-chrome.module.css";

import { AuthForm } from "@/app/auth/auth-form";
import { BrandLogo } from "@/components/brand-logo";
import { safeRedirectPath } from "@/lib/redirects";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in or create your Pinpoint account.",
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
          className={`${chrome.palette} ${chrome.brandLink} mb-8 w-fit gap-2 border border-border bg-panel px-3 transition-colors hover:bg-warm-surface`}
          href="/"
        >
          <BrandLogo size={16} nameClassName="text-sm font-medium" />
        </Link>
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase text-clay">Account access</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink" tabIndex={-1}>
            Continue to Pinpoint
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
