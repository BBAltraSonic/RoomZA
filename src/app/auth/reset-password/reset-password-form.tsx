"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";

import { updatePasswordAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(updatePasswordAction, {});

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border border-border bg-panel p-4 shadow-[var(--elevation-2)]">
      <input name="token" type="hidden" value={token} />
      <label className="grid gap-1.5 text-sm font-medium text-ink">
        New password
        <span className="flex h-11 items-center gap-2 rounded-md border border-input bg-warm-surface px-3">
          <KeyRound className="size-4 text-muted-foreground" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            name="password"
            minLength={6}
            required
            type="password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
          />
        </span>
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-ink">
        Confirm new password
        <span className="flex h-11 items-center gap-2 rounded-md border border-input bg-warm-surface px-3">
          <KeyRound className="size-4 text-muted-foreground" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            name="confirmPassword"
            minLength={6}
            required
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
          />
        </span>
      </label>
      {state.message ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            state.success ? "border-forest/30 bg-forest/5 text-forest" : "border-rose-200 bg-rose-50 text-rose-800",
          )}
          role="alert"
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
      <Button className="h-11 bg-forest text-primary-foreground hover:bg-forest/90" disabled={pending} type="submit">
        {pending ? "Updating password..." : "Update password"}
      </Button>
    </form>
  );
}
