import type { Metadata } from "next";
import Link from "next/link";
import chrome from "@/components/navigation/pinpoint-chrome.module.css";

import { BrandLogo } from "@/components/brand-logo";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your Pinpoint account.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
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
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">Choose a new password</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Pick a strong password you don&apos;t use anywhere else.
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
