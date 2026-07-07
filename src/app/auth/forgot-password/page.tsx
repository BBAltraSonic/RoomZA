import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Request a password reset link for your Pinpoints account.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
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
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">Reset your password</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Enter your email and we&apos;ll send you a secure link to choose a new password.
          </p>
        </div>
        <ForgotPasswordForm />
        <Link
          href="/auth"
          className="mt-6 inline-flex items-center gap-2 justify-self-center text-sm font-medium text-forest underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
