"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { requestOfferWorkspace } from "./workspace-request";
import { useWorkspaceReady } from "./use-workspace-ready";

export function PosterControls({ enrollment }: { enrollment: "active" | "required" | "revoked" }) {
  const router = useRouter();
  const ready = useWorkspaceReady();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [nextPath, setNextPath] = useState<string>();
  const [offerId, setOfferId] = useState<string>();
  if (enrollment === "revoked") return <p role="alert" className="text-sm text-destructive">Poster access has been revoked. Re-enrollment cannot restore it.</p>;
  return <div className="space-y-3">
    {enrollment === "required" ? <p className="max-w-prose text-sm text-muted-foreground">Create a Shopping Special draft. Submitted versions need admin confirmation before publication.</p> : null}
    <Button type="button" className="min-h-11" disabled={!ready || pending} onClick={async () => {
      if (busy.current) return;
      busy.current = true; setPending(true); setError(""); setNextPath(undefined);
      try {
        const id = offerId ?? crypto.randomUUID();
        setOfferId(id);
        const result = await requestOfferWorkspace({ command: "create", offerId: id, expectedVersion: 0 });
        if (!result.ok) {
          setError(result.message); setNextPath(result.nextPath);
          if (result.status === 409) router.push(`/post/offers/${id}`);
        } else router.push(`/post/offers/${id}`);
      } catch { setError("Could not complete this request. Try again or check your drafts."); }
      finally { busy.current = false; setPending(false); }
    }}>{pending ? "Please wait…" : "Create private draft"}</Button>
    {error ? <p role="alert" className="max-w-prose text-sm text-destructive">{error} {nextPath ? <Link href={nextPath} className="underline">Continue to your account</Link> : null}</p> : null}
  </div>;
}
