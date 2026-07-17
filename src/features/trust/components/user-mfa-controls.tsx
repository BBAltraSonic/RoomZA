"use client";

import { useState } from "react";
import Image from "next/image";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

type Factor = { id: string; friendlyName: string | null };

export function UserMfaControls({ initialFactors }: { initialFactors: Factor[] }) {
  const [factors, setFactors] = useState(initialFactors);
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  async function beginEnrollment() {
    setPending(true);
    const { data, error } = await createClient().auth.mfa.enroll({ factorType: "totp", friendlyName: "Pinpoint authenticator" });
    setPending(false);
    if (error) return toast.error(error.message);
    setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verifyEnrollment() {
    if (!enrollment) return;
    setPending(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrollment.id, code: code.trim() });
    setPending(false);
    if (error) return toast.error("That authenticator code was not accepted.");
    setFactors((current) => [...current, { id: enrollment.id, friendlyName: "Pinpoint authenticator" }]);
    setEnrollment(null);
    setCode("");
    toast.success("Authenticator MFA enabled");
  }

  async function removeFactor(id: string) {
    setPending(true);
    const { error } = await createClient().auth.mfa.unenroll({ factorId: id });
    setPending(false);
    if (error) return toast.error(error.message);
    setFactors((current) => current.filter((factor) => factor.id !== id));
    toast.success("Authenticator removed");
  }

  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-ink">Authenticator MFA</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Require a current authenticator code after signing in on a new session.</p></div>{factors.length ? <ShieldCheck className="size-5 text-forest" /> : <KeyRound className="size-5 text-muted-foreground" />}</div>
      {factors.length ? <div className="mt-4 divide-y divide-border border-y border-border">{factors.map((factor, index) => <div key={factor.id} className="flex min-h-14 items-center justify-between gap-4 py-3"><p className="text-sm font-semibold text-ink">{factor.friendlyName || `Authenticator ${index + 1}`}</p><Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => void removeFactor(factor.id)}>Remove</Button></div>)}</div> : null}
      {!enrollment ? <Button className="mt-4" type="button" variant="outline" disabled={pending} onClick={() => void beginEnrollment()}>Set up authenticator</Button> : <div className="mt-4 rounded-xl border border-border p-4"><p className="text-sm font-semibold text-ink">Scan this code with an authenticator app</p><Image src={enrollment.qr} alt="Authenticator QR code" width={192} height={192} unoptimized className="mx-auto mt-4 size-48 rounded-lg bg-white p-3" /><p className="mt-3 break-all rounded-lg bg-muted p-3 font-mono text-xs text-ink"><span className="font-sans font-semibold">Manual key: </span>{enrollment.secret}</p><div className="mt-3 flex gap-2"><Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="Authenticator code" placeholder="123456" /><Button type="button" disabled={pending || code.length !== 6} onClick={() => void verifyEnrollment()}>Verify</Button></div></div>}
    </div>
  );
}
