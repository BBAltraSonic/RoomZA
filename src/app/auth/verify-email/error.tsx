"use client";

import { AlertCircle, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function VerifyEmailError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="rounded-lg border border-destructive/20 bg-panel p-5 shadow-[var(--elevation-2)]">
          <div className="mb-5 flex size-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <AlertCircle className="size-5" />
          </div>
          <p className="text-xs font-semibold uppercase text-clay">Email verification</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-ink">
            We could not verify that link
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground" role="alert">
            Try again, or request a fresh verification link.
          </p>
          <Button className="mt-5 h-11 bg-forest text-primary-foreground hover:bg-forest/90" onClick={reset} type="button">
            <RefreshCcw className="mr-2 size-4" />
            Try again
          </Button>
        </div>
      </div>
    </main>
  );
}
