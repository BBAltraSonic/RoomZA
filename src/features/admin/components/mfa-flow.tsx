"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";
import { adminMfaEnrollmentError } from "@/features/admin/policy";

export function MfaSetup({ requiredFactors, verifiedFactors }: { requiredFactors: number; verifiedFactors: number }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [pending, setPending] = useState(false);
  const enrollmentStartedFor = useRef<number | null>(null);
  const enrollmentGeneration = useRef(0);

  useEffect(() => {
    if (verifiedFactors >= requiredFactors) {
      enrollmentGeneration.current += 1;
      router.replace("/admin/security/mfa/challenge");
      return;
    }
    if (enrollmentStartedFor.current === verifiedFactors) return;

    enrollmentStartedFor.current = verifiedFactors;
    const generation = ++enrollmentGeneration.current;
    setFactorId("");
    setQr("");
    setSecret("");
    setCode("");
    setError("");
    setRecoveryRequired(false);

    const supabase = createClient();
    void supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Pinpoints admin factor ${verifiedFactors + 1}` }).then(({ data, error: enrollError }) => {
      if (generation !== enrollmentGeneration.current) return;
      if (enrollError) {
        setRecoveryRequired(true);
        return setError(adminMfaEnrollmentError(enrollError.message));
      }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    });
  }, [requiredFactors, router, verifiedFactors]);

  async function verify() {
    if (pending) return;
    setError("");
    setRecoveryRequired(false);
    setPending(true);

    try {
      const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (verifyError) {
        setCode("");
        setError("That code did not match this authenticator. Enter its newest six-digit code and try again.");
        return;
      }

      if (verifiedFactors + 1 >= requiredFactors) {
        router.replace("/admin");
        router.refresh();
        return;
      }

      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-panel p-6 shadow-[var(--elevation-2)]">
      <ShieldCheck className="size-8 text-forest" />
      <h1 className="mt-4 text-2xl font-semibold text-ink">Secure admin access</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Enroll factor {verifiedFactors + 1} of {requiredFactors}. Scan the code with an authenticator app, then enter its six-digit code.</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- Supabase returns an inline QR data URL. */}
      {qr ? <img src={qr} alt="Authenticator QR code" className="mx-auto mt-6 size-52 rounded-lg bg-[oklch(0.98_0.003_165)] p-3" /> : <div className="mt-6 h-52 animate-pulse rounded-lg bg-muted" />}
      {secret ? <p className="mt-3 break-all rounded-lg bg-muted p-3 font-mono text-xs text-ink"><span className="font-sans font-semibold">Manual key: </span>{secret}</p> : null}
      <form className="mt-5 flex gap-2" onSubmit={(event) => { event.preventDefault(); void verify(); }} aria-busy={pending}>
        <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} aria-label="Authenticator code" aria-invalid={Boolean(error)} disabled={pending} placeholder="123456" />
        <Button type="submit" disabled={!factorId || code.length !== 6 || pending}><KeyRound className="size-4" />{pending ? "Verifying..." : "Verify"}</Button>
      </form>
      {error ? (
        <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
          <p role="alert" className="text-sm font-medium text-destructive">{error}</p>
          {recoveryRequired ? (
            <form action="/auth/sign-out" method="post">
              <Button className="mt-3" type="submit" variant="outline">Sign in again</Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MfaChallenge({ factors }: { factors: { id: string; friendly_name?: string | null }[] }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState(factors[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function verify() {
    setError("");
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (verifyError) return setError("The code was not accepted.");
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-panel p-6 shadow-[var(--elevation-2)]">
      <KeyRound className="size-8 text-forest" />
      <h1 className="mt-4 text-2xl font-semibold text-ink">Verify it is you</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Enter the current code from your authenticator app.</p>
      {factors.length > 1 ? <select value={factorId} onChange={(event) => setFactorId(event.target.value)} className="mt-5 h-11 w-full rounded-lg bg-background px-3 shadow-[var(--neu-inset-sm)]">{factors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.friendly_name || `Authenticator ${index + 1}`}</option>)}</select> : null}
      <Input className="mt-5" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} aria-label="Authenticator code" placeholder="123456" />
      <Button className="mt-3 w-full" type="button" onClick={verify} disabled={!factorId || code.length !== 6}>Continue</Button>
      {error ? <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
