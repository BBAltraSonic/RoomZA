"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

export function UserMfaChallenge({ factors, redirectTo }: { factors: { id: string; friendlyName: string | null }[]; redirectTo: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState(factors[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function verify() {
    setPending(true);
    setError("");
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setPending(false);
    if (verifyError) return setError("The current authenticator code was not accepted.");
    router.replace(redirectTo);
    router.refresh();
  }

  return <div className="mx-auto max-w-md rounded-2xl border border-border bg-panel p-6 shadow-[var(--elevation-2)]"><KeyRound className="size-7 text-forest" /><h1 className="mt-4 text-2xl font-semibold text-ink">Verify it is you</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Enter the current code from your authenticator app to continue.</p>{factors.length > 1 ? <select className="mt-5 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" value={factorId} onChange={(event) => setFactorId(event.target.value)}>{factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendlyName || `Authenticator ${index + 1}`}</option>)}</select> : null}<Input className="mt-4" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="Authenticator code" placeholder="123456" /><Button className="mt-3 w-full" type="button" disabled={pending || !factorId || code.length !== 6} onClick={() => void verify()}>{pending ? "Verifying..." : "Continue"}</Button>{error ? <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p> : null}</div>;
}
