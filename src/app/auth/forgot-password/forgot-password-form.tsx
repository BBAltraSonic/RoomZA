"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";

import { requestPasswordResetAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, {});
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border border-border bg-panel p-4 shadow-[var(--elevation-2)]">
      <input name="origin" type="hidden" value={origin} />
      <label className="grid gap-1.5 text-sm font-medium text-ink">
        Email
        <span className="flex h-11 items-center gap-2 rounded-md border border-input bg-warm-surface px-3">
          <Mail className="size-4 text-muted-foreground" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
            autoComplete="email"
          />
        </span>
      </label>
      {state.message ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            state.success ? "border-forest/30 bg-forest/5 text-forest" : "border-rose-200 bg-rose-50 text-rose-800",
          )}
          role={state.success ? "status" : "alert"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
      <TurnstileWidget className="flex min-h-[72px] justify-center overflow-x-auto" />
      <Button className="h-11 bg-forest text-primary-foreground hover:bg-forest/90" disabled={pending} type="submit">
        {pending ? "Sending link..." : "Send reset link"}
      </Button>
    </form>
  );
}
