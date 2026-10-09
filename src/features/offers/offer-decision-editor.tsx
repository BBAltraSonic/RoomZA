"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { safeRedirectPath } from "@/lib/redirects";
import { useWorkspaceReady } from "./use-workspace-ready";
import type { LocationReviewSnapshot } from "./location-review-contract";
import { OFFER_APPROVAL_STATEMENT, OFFER_APPROVAL_VERSION, type OfferDecisionRequest, type OfferDecisionSnapshot } from "./decision-contract";

type DecisionInput = Omit<Extract<OfferDecisionRequest, { command: "approve" }>, "requestId"> | Omit<Extract<OfferDecisionRequest, { command: "unpublish" }>, "requestId">;
const date = (value: string) => new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(value));
function useDecisionWriter() {
  const ready = useWorkspaceReady();
  const busy = useRef(false), requestId = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [nextPath, setNextPath] = useState<string>();
  const locked = !ready || pending || blocked || complete;
  async function write(input: DecisionInput) {
    if (busy.current || locked) return;
    busy.current = true; setPending(true); setError(""); setNextPath(undefined);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/private/offers/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, requestId: requestId.current }) });
      const body = await response.json();
      if (!response.ok) {
        const message = typeof body.error === "string" ? body.error : body.error?.message;
        setError(typeof message === "string" ? message : "Could not record the decision. Your text is still here.");
        if (typeof body.nextPath === "string") setNextPath(safeRedirectPath(body.nextPath, "/admin/offers"));
        else if (body.error?.code === "account_suspended") setNextPath("/account-suspended");
        else if (response.status === 401) setNextPath(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
        setBlocked(true); return;
      }
      setComplete(true);
    } catch { setError("Connection interrupted. Your text is still here. Load the current offer before retrying."); setBlocked(true); }
    finally { busy.current = false; setPending(false); }
  }
  return { pending, blocked, complete, error, nextPath, locked, write, edited: () => { requestId.current = null; } };
}
function DecisionFeedback({ writer }: { writer: ReturnType<typeof useDecisionWriter> }) {
  return <>
    {writer.error ? <div role="alert" className="space-y-3 text-sm text-destructive"><p>{writer.error}</p>{writer.nextPath ? <Link href={writer.nextPath} className="underline">Resolve account access</Link> : null}</div> : null}
    {writer.blocked || writer.complete ? <div className="space-y-2 text-sm"><p className="text-muted-foreground">Copy any text you need to keep before loading the current offer.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Load current offer decision</Button></div> : null}
  </>;
}
export function OfferApprovalEditor({ review }: { review: LocationReviewSnapshot }) {
  const writer = useDecisionWriter();
  const [confirmed, setConfirmed] = useState(false);
  const evidence = review.evidence;
  const current = evidence && review.place && review.permissionReviewId && evidence.offerVersion === review.version
    && evidence.permissionReviewId === review.permissionReviewId && JSON.stringify(evidence.placeSnapshot) === JSON.stringify(review.place);
  return <section aria-labelledby="offer-approval-title" className="max-w-3xl space-y-5 rounded-xl border border-border p-5">
    <h2 id="offer-approval-title" className="text-lg font-semibold">Final offer confirmation</h2>
    <p className="text-sm text-muted-foreground">Confirm the exact submitted snapshot and reviewed validity window. Private saves preserve it; a submitted material edit, withdrawal or unpublication removes its approval.</p>
    {writer.complete ? <p role="status" className="text-sm font-medium text-forest">Approved snapshot recorded. Reload to inspect the decision or unpublish this offer.</p> : current ? <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault(); if (!confirmed || !evidence || !review.permissionReviewId) return;
      void writer.write({ command: "approve", offerId: review.offerId, revisionId: review.revisionId, expectedVersion: review.version,
        permissionReviewId: review.permissionReviewId, locationReviewId: evidence.id, approvalConfirmed: true, statementVersion: OFFER_APPROVAL_VERSION });
    }}>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" disabled={writer.locked} className="mt-1 size-5 shrink-0 accent-forest" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{OFFER_APPROVAL_STATEMENT}</span></label>
      <Button type="submit" className="min-h-11" disabled={writer.locked || !confirmed}>{writer.pending ? "Confirming…" : "Approve offer snapshot"}</Button>
    </form> : <div className="space-y-3 text-sm"><p>Record current permission and place, shop and date evidence first. Reload to load the complete current review.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Load current approval review</Button></div>}
    <DecisionFeedback writer={writer} />
  </section>;
}
export function OfferDecisionEditor({ snapshot }: { snapshot: OfferDecisionSnapshot }) {
  const writer = useDecisionWriter();
  const [reason, setReason] = useState("");
  const decision = snapshot.decision, content = snapshot.content;
  const approved = decision.action === "approve" && !snapshot.pendingRevisionId && !snapshot.withdrawnAt;
  return <section aria-labelledby="offer-decision-title" className="max-w-3xl space-y-6">
    <div><p className="text-sm text-muted-foreground">Reviewed snapshot · Captured offer version {snapshot.version}</p><h1 id="offer-decision-title" className="mt-2 break-words text-2xl font-semibold">{content.title}</h1></div>
    <p className="rounded-xl border border-border bg-muted p-4 text-sm">{approved && !writer.complete ? "This snapshot has a recorded approval for its validity window." : "This snapshot’s approval has been removed. Returning to approval requires a fresh poster submission and separate review."}</p>
    <dl className="grid gap-5 border-y border-border py-6 text-sm sm:grid-cols-2">
      {[["Benefit", content.benefit], ["Exact terms", content.terms], ["Shop", content.shopName], ["Public address", content.address],
        ["Exact shop point", `${content.latitude}, ${content.longitude}`], ["Starts", date(content.startsAt)], ["Ends", date(content.endsAt)],
        ["Captured decision", decision.action === "approve" ? "Approved" : decision.action === "unpublish" ? "Unpublished" : "Approval invalidated"],
        ["Recorded", date(decision.occurredAt)], ["Decision actor", decision.actorId]].map(([label, value]) => <div key={label} className={label === "Exact terms" ? "sm:col-span-2" : ""}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium">{value}</dd></div>)}
    </dl>
    {decision.reason ? <p className="whitespace-pre-wrap break-words text-sm">Decision reason: {decision.reason}</p> : null}
    {writer.complete ? <p role="status" className="text-sm font-medium text-forest">Unpublication recorded. This offer needs a fresh submitted review before returning.</p> : approved ? <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault(); if (!reason.trim()) return;
      void writer.write({ command: "unpublish", offerId: snapshot.offerId, revisionId: decision.revisionId, expectedVersion: snapshot.version, reason });
    }}>
      <label className="grid gap-2 text-sm font-medium">Unpublication reason<textarea className="min-h-28 w-full resize-y rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={reason} maxLength={2000} disabled={writer.locked} onChange={(event) => { setReason(event.target.value); writer.edited(); }} aria-describedby="unpublication-help" /></label>
      <p id="unpublication-help" className="text-xs text-muted-foreground">Record why the reviewed offer must be removed. The poster will need a fresh submission before approval can return.</p>
      <Button type="submit" variant="destructive" className="min-h-11" disabled={writer.locked || !reason.trim()}>{writer.pending ? "Removing…" : "Unpublish offer"}</Button>
    </form> : null}
    <DecisionFeedback writer={writer} />
    <nav aria-label="Offer review navigation" className="flex flex-wrap gap-6"><Link href="/admin/offers/confirmed" prefetch={false} className="inline-flex min-h-11 items-center text-sm font-medium text-forest underline">Back to confirmed offers</Link><Link href="/admin/offers" prefetch={false} className="inline-flex min-h-11 items-center text-sm font-medium text-forest underline">Back to pending offers</Link></nav>
  </section>;
}
