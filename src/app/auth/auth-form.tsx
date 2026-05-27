"use client";

import { useActionState, useState } from "react";
import { KeyRound, Mail } from "lucide-react";

import { signInAction, signUpAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "create";

export function AuthForm({ redirectPath = "/" }: { redirectPath?: string }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [signInState, signInFormAction, signInPending] = useActionState(signInAction, {});
  const [signUpState, signUpFormAction, signUpPending] = useActionState(signUpAction, {});
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const isCreate = mode === "create";
  const pending = isCreate ? signUpPending : signInPending;
  const state = isCreate ? signUpState : signInState;

  return (
    <div className="rounded-lg border border-border bg-panel p-4 shadow-[var(--elevation-2)]">
      <div className="mb-4 grid grid-cols-2 rounded-md bg-warm-surface p-1">
        {[
          ["sign-in", "Sign in"],
          ["create", "Create account"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value as Mode)}
            className={cn(
              "h-9 rounded-md text-sm font-medium transition-colors",
              mode === value ? "bg-panel text-forest shadow-[var(--elevation-1)]" : "text-muted-foreground hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form action={isCreate ? signUpFormAction : signInFormAction} className="grid gap-4">
        <input name="origin" type="hidden" value={origin} />
        <input name="redirect" type="hidden" value={redirectPath} />
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
            />
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-ink">
          Password
          <span className="flex h-11 items-center gap-2 rounded-md border border-input bg-warm-surface px-3">
            <KeyRound className="size-4 text-muted-foreground" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              minLength={6}
              name="password"
              required
              type="password"
            />
          </span>
        </label>
        {state.message ? (
          <p className={cn("rounded-md border px-3 py-2 text-sm", isCreate ? "border-border bg-warm-surface text-muted-foreground" : "border-rose-200 bg-rose-50 text-rose-800")}>
            {state.message}
          </p>
        ) : null}
        <Button className="h-11 bg-forest text-primary-foreground hover:bg-forest/90" disabled={pending} type="submit">
          {pending ? (isCreate ? "Creating account..." : "Signing in...") : isCreate ? "Create account" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
