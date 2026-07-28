"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, KeyRound, Mail, WandSparkles } from "lucide-react";
import * as m from "motion/react-m";

import { signInAction, signUpAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { generatePassword } from "@/features/auth/generated-password";
import { MotionFeedback, PendingGlyph } from "@/lib/motion/primitives";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "create";

export function AuthForm({ redirectPath = "/" }: { redirectPath?: string }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [signInState, signInFormAction, signInPending] = useActionState(signInAction, {});
  const [signUpState, signUpFormAction, signUpPending] = useActionState(signUpAction, {});
  const isCreate = mode === "create";
  const pending = isCreate ? signUpPending : signInPending;
  const state = isCreate ? signUpState : signInState;
  const passwordsMismatch = isCreate && confirmPassword.length > 0 && password !== confirmPassword;

  function selectMode(nextMode: Mode) {
    setMode(nextMode);
    setConfirmPassword("");
    setGeneratedMessage("");
  }

  function useGeneratedPassword() {
    const generatedPassword = generatePassword();
    setPassword(generatedPassword);
    setConfirmPassword(generatedPassword);
    setGeneratedMessage("Generated password filled in both fields.");
  }

  return (
    <div className="rounded-[var(--radius-card)_var(--radius-cut)_var(--radius-card)_var(--radius-card)] border border-border bg-panel p-4 shadow-[var(--shadow-card)]">
      <Button
        type="button"
        variant="outline"
        className="mb-4 h-11 w-full bg-warm-surface text-muted-foreground hover:bg-warm-surface hover:text-muted-foreground"
        disabled
        aria-disabled="true"
        title="Google sign-in is coming soon"
      >
        <svg className="mr-2 size-5 opacity-60" viewBox="0 0 24 24">
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
        Continue with Google
        <span className="ml-2 rounded-full border border-border bg-panel px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Coming soon
        </span>
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
            onClick={() => selectMode(value as Mode)}
            className={cn(
              "relative h-9 rounded-md text-sm font-medium transition-colors",
              mode === value ? "text-forest" : "text-muted-foreground hover:text-ink",
            )}
          >
            {mode === value ? <m.span layoutId="auth-mode-indicator" data-motion-layout-id="auth-mode-indicator" className="absolute inset-0 rounded-md bg-panel shadow-[var(--elevation-1)]" /> : null}
            <span className="relative z-10">{label}</span>
          </button>
        ))}
      </div>

      <form action={isCreate ? signUpFormAction : signInFormAction} className="grid gap-4">
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
        <div className="grid gap-1.5">
          <div className="flex min-h-6 items-center justify-between gap-3">
            <label className="text-sm font-medium text-ink" htmlFor="auth-password">
              Password
            </label>
            {isCreate ? (
              <button
                className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-forest outline-none transition-colors hover:bg-forest/5 focus-visible:ring-2 focus-visible:ring-forest"
                onClick={useGeneratedPassword}
                type="button"
              >
                <WandSparkles className="size-3.5" />
                Use generated password
              </button>
            ) : null}
          </div>
          <span className="flex h-11 items-center gap-2 rounded-md border border-input bg-warm-surface pl-3 transition-shadow focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/20">
            <KeyRound className="size-4 text-muted-foreground" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              autoComplete={isCreate ? "new-password" : "current-password"}
              id="auth-password"
              minLength={6}
              name="password"
              onChange={(event) => {
                setPassword(event.target.value);
                setGeneratedMessage("");
              }}
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-forest"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </div>
        {isCreate ? (
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-ink" htmlFor="auth-confirm-password">
              Retype password
            </label>
            <span
              className={cn(
                "flex h-11 items-center gap-2 rounded-md border bg-warm-surface pl-3 transition-shadow focus-within:ring-2",
                passwordsMismatch
                  ? "border-rose-400 focus-within:border-rose-500 focus-within:ring-rose-500/20"
                  : "border-input focus-within:border-forest focus-within:ring-forest/20",
              )}
            >
              <KeyRound className="size-4 text-muted-foreground" />
              <input
                aria-describedby={passwordsMismatch ? "auth-confirm-password-error" : undefined}
                aria-invalid={passwordsMismatch}
                autoComplete="new-password"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                id="auth-confirm-password"
                minLength={6}
                name="confirmPassword"
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setGeneratedMessage("");
                }}
                required
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
              />
              <button
                aria-label={showPassword ? "Hide retyped password" : "Show retyped password"}
                aria-pressed={showPassword}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-forest"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
            {passwordsMismatch ? (
              <p className="text-xs font-medium text-rose-700" id="auth-confirm-password-error">
                Passwords do not match.
              </p>
            ) : null}
            {generatedMessage ? (
              <p aria-live="polite" className="text-xs text-muted-foreground" role="status">
                {generatedMessage}
              </p>
            ) : null}
          </div>
        ) : null}
        {!isCreate ? (
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink">
            <input
              className="size-4 rounded border-input text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
              name="remember"
              type="checkbox"
            />
            Remember me for 30 days
          </label>
        ) : (
          <div className="grid gap-2">
            <label className="flex min-h-11 items-start gap-3 text-sm leading-6 text-ink">
              <input className="mt-1 size-4 rounded border-input text-forest focus-visible:ring-2 focus-visible:ring-forest" name="acceptPolicies" required type="checkbox" />
              <span>I accept the <Link href="/trust/terms" className="font-semibold text-forest hover:underline">Terms of Service</Link> and acknowledge the <Link href="/trust/privacy" className="font-semibold text-forest hover:underline">Privacy Policy</Link>.</span>
            </label>
            <label className="flex min-h-11 items-start gap-3 text-sm leading-6 text-ink">
              <input className="mt-1 size-4 rounded border-input text-forest focus-visible:ring-2 focus-visible:ring-forest" name="marketing" type="checkbox" />
              <span>Send me optional Pinpoint product and marketplace news.</span>
            </label>
          </div>
        )}
        {state.message ? (
          <MotionFeedback state={state.success ? "success" : "error"}>
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
          </MotionFeedback>
        ) : null}
        <TurnstileWidget className="flex min-h-[72px] justify-center overflow-x-auto" />
        <Button className="h-11 bg-forest text-primary-foreground hover:bg-forest/90" disabled={pending || passwordsMismatch} type="submit">
          {pending ? <PendingGlyph label={isCreate ? "Creating account" : "Signing in"} /> : null}
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
