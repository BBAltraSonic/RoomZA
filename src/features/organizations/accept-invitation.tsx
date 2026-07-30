"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { acceptOrganizationInvitation } from "./actions";

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <div className="mt-5">
      <Button disabled={pending || !token} onClick={() => startTransition(async () => {
        const result = await acceptOrganizationInvitation(token);
        if (!result.success) {
          setMessage(result.error);
          return;
        }
        router.push("/dashboard");
        router.refresh();
      })}>{pending ? "Accepting…" : "Accept invitation"}</Button>
      {message ? (
        <div role="alert" className="mt-4 rounded-md border border-status-warning-border bg-status-warning-surface p-3 text-sm text-status-warning-text">
          {message}{" "}
          {message.startsWith("Sign in") ? <Link href={`/auth?redirect=${encodeURIComponent(`/organization/invite?token=${token}`)}`} className="font-semibold underline">Sign in or create an account</Link> : null}
        </div>
      ) : null}
    </div>
  );
}
