"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { safeRedirectPath } from "@/lib/redirects";
import { useWorkspaceReady } from "./use-workspace-ready";
import type { OfferReviewSnapshot } from "./review-contract";

const date = (value: string) => new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(value));
export function OfferReviewEditor({ submission }: { submission: OfferReviewSnapshot }) {
  const ready = useWorkspaceReady();
  const busy = useRef(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [nextPath, setNextPath] = useState<string>();
  const content = submission.content;
  async function reject() {
    if (busy.current || blocked || complete) return;
    if (!reason.trim()) { setError("Add a correction reason for the poster."); return; }
    busy.current = true; setPending(true); setError(""); setNextPath(undefined);
    try {
      const response = await fetch("/api/private/offers/reject", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId: submission.offerId, revisionId: submission.revisionId, expectedVersion: submission.version, reason }) });
      const result = await response.json();
      if (!response.ok) {
        const message = typeof result.error === "string" ? result.error : result.error?.message;
        setError(typeof message === "string" ? message : "Could not record the correction. Your text is still here.");
        if (typeof result.nextPath === "string") setNextPath(safeRedirectPath(result.nextPath, "/admin/offers"));
        else if (result.error?.code === "account_suspended") setNextPath("/account-suspended");
        else if (response.status === 401) setNextPath(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
        setBlocked(true);
        return;
      }
      setComplete(true);
    } catch { setError("Connection interrupted. Your text is still here. Load the current submission before retrying."); setBlocked(true); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="max-w-3xl space-y-7">
    <div><p className="text-sm text-muted-foreground">Submitted {date(submission.submittedAt)} · Version {submission.version}</p><h1 className="mt-2 text-2xl font-semibold break-words">{content.title}</h1></div>
    <p className="text-sm text-muted-foreground">Review this submitted snapshot. Later private draft edits are excluded. Times use South Africa time (UTC+02:00).</p>
    <dl className="grid gap-5 border-y border-border py-6 text-sm sm:grid-cols-2">
      {([ ["Benefit", content.benefit], ["Exact terms", content.terms], ["Shop", content.shopName], ["Public address", content.address], ["Place ID", content.areaId], ["Exact shop point", `${content.latitude}, ${content.longitude}`], ["Starts", date(content.startsAt)], ["Ends", date(content.endsAt)] ]).map(([label, value]) => <div key={label} className={label === "Exact terms" ? "sm:col-span-2" : ""}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium">{value}</dd></div>)}
    </dl>
    <p className="rounded-xl border border-border bg-muted p-4 text-sm">Record permission, place, shop and date evidence before final confirmation, or return the submission for correction.</p>
    {complete ? <p role="status" className="rounded-xl border border-border p-4 text-sm">Correction recorded. The poster can see your reason and submit a fresh revision. This offer is not public.</p> : <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void reject(); }}>
      <label className="grid gap-2 text-sm font-medium">Correction reason<textarea name="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} disabled={!ready || pending || blocked} className="min-h-36 w-full rounded-xl border border-border bg-panel px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-describedby="correction-help" /></label>
      <p id="correction-help" className="text-xs text-muted-foreground">Explain what needs changing. Sending this rejects the current submission and keeps it private; it does not restore an earlier version.</p>
      <Button type="submit" disabled={!ready || pending || blocked} className="min-h-11">{pending ? "Recording…" : "Return for correction"}</Button>
    </form>}
    {error ? <div role="alert" className="space-y-3 text-sm"><p>{error}</p>{nextPath ? <Link href={nextPath} className="underline">Resolve account access</Link> : null}{blocked ? <Button type="button" variant="outline" onClick={() => window.location.reload()}>Load current submission</Button> : null}</div> : null}
    <Link href="/admin/offers" className="inline-flex min-h-11 items-center text-sm font-medium text-forest underline">Back to pending offers</Link>
  </div>;
}
