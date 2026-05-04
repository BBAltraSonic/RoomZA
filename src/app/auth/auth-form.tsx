"use client";

import { useActionState } from "react";
import { KeyRound, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signInAction, signUpAction } from "@/app/auth/actions";

export function AuthForm() {
  const [signInState, signInFormAction, signInPending] = useActionState(signInAction, {});
  const [signUpState, signUpFormAction, signUpPending] = useActionState(signUpAction, {});
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="grid gap-4">
      <form action={signInFormAction} className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
        <input name="origin" type="hidden" value={origin} />
        <label className="grid gap-1.5 text-sm font-medium">
          Email
          <span className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
            <Mail className="size-4 text-muted-foreground" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Password
          <span className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
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
        {signInState.message ? <p className="text-sm text-destructive">{signInState.message}</p> : null}
        <Button className="h-10" disabled={signInPending} type="submit">
          {signInPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <form action={signUpFormAction} className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
        <input name="origin" type="hidden" value={origin} />
        <label className="grid gap-1.5 text-sm font-medium">
          Email
          <span className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
            <Mail className="size-4 text-muted-foreground" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Password
          <span className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
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
        {signUpState.message ? (
          <p className="text-sm text-muted-foreground">{signUpState.message}</p>
        ) : null}
        <Button className="h-10" disabled={signUpPending} type="submit" variant="outline">
          {signUpPending ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </div>
  );
}
