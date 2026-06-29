"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";

import { signInAction, signUpAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "create";

export function AuthForm({ redirectPath = "/" }: { redirectPath?: string }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [signInState, signInFormAction, signInPending] = useActionState(signInAction, {});
  const [signUpState, signUpFormAction, signUpPending] = useActionState(signUpAction, {});
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const isCreate = mode === "create";
  const pending = (isCreate ? signUpPending : signInPending) || isGoogleLoading;
  const state = isCreate ? signUpState : signInState;

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectPath)}`,
        },
      });
      
      if (error) {
        toast.error(error.message);
        setIsGoogleLoading(false);
      }
    } catch {
      toast.error("An unexpected error occurred while connecting to Google.");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-panel p-4 shadow-[var(--elevation-2)]">
      <Button
        type="button"
        variant="outline"
        className="mb-4 h-11 w-full bg-warm-surface text-ink hover:bg-warm-surface/80 hover:text-ink"
        disabled={pending}
        onClick={handleGoogleSignIn}
      >
        <svg className="mr-2 size-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {isGoogleLoading ? "Connecting to Google..." : "Continue with Google"}
      </Button>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-panel px-2 text-muted-foreground">Or continue with email</span>
        </div>
      </div>

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
          <p
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              state.success
                ? "border-forest/30 bg-forest/5 text-forest"
                : "border-rose-200 bg-rose-50 text-rose-800",
            )}
            role={state.success ? "status" : "alert"}
            aria-live="polite"
          >
            {state.message}
          </p>
        ) : null}
        <TurnstileWidget className="flex min-h-[72px] justify-center overflow-x-auto" />
        <Button className="h-11 bg-forest text-primary-foreground hover:bg-forest/90" disabled={pending} type="submit">
          {pending ? (isCreate ? "Creating account..." : "Signing in...") : isCreate ? "Create account" : "Sign in"}
        </Button>
        {!isCreate ? (
          <Link
            href={`/auth/forgot-password${redirectPath && redirectPath !== "/" ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
            className="justify-self-center text-sm font-medium text-forest underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        ) : null}
      </form>
    </div>
  );
}
