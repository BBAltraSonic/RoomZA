"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { safeRedirectPath } from "@/lib/redirects";
import { useWorkspaceReady } from "./use-workspace-ready";
import { PERMISSION_REVIEW_STATEMENT, PERMISSION_REVIEW_VERSION, type PermissionReviewSnapshot } from "./permission-review-contract";

const control = "min-h-11 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const date = (value: string) => new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(value));
export function OfferPermissionEvidenceEditor({ snapshot }: { snapshot: PermissionReviewSnapshot }) {
  const ready = useWorkspaceReady();
  const busy = useRef(false), requestId = useRef<string | null>(null);
  const [kind, setKind] = useState<"written_authorization" | "existing_business_permission">("written_authorization");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [nextPath, setNextPath] = useState<string>();
  const locked = !ready || pending || blocked || complete;
  function edited() { requestId.current = null; setConfirmed(false); }
  async function record() {
    if (busy.current || blocked || complete) return;
    if (!confirmed || !reference.trim() || !note.trim()) { setError("Add an authorization reference, a verification note and explicit confirmation."); return; }
    busy.current = true; setPending(true); setError(""); setNextPath(undefined);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/private/offers/permission-evidence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        offerId: snapshot.offerId, revisionId: snapshot.revisionId, expectedVersion: snapshot.version, requestId: requestId.current,
        evidenceKind: kind, sourceReference: reference, verificationNote: note, authorizationChecked: true, statementVersion: PERMISSION_REVIEW_VERSION,
      }) });
      const body = await response.json();
      if (!response.ok) {
        setError(typeof body.error === "string" ? body.error : typeof body.error?.message === "string" ? body.error.message : "Could not record permission evidence. Your text is still here.");
        if (typeof body.nextPath === "string") setNextPath(safeRedirectPath(body.nextPath, "/admin/offers"));
        else if (body.error?.code === "account_suspended") setNextPath("/account-suspended");
        else if (response.status === 401) setNextPath(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
        setBlocked(true); return;
      }
      setComplete(true);
    } catch { setError("Connection interrupted. Your evidence text is still here. Load the current submission before retrying."); setBlocked(true); }
    finally { busy.current = false; setPending(false); }
  }
  return <section aria-labelledby="permission-evidence-title" className="max-w-3xl space-y-5 rounded-xl border border-border p-5">
    <h2 id="permission-evidence-title" className="text-lg font-semibold">Permission review</h2>
    {snapshot.permission ? <div className="space-y-2 text-sm"><p className="font-medium">Poster confirmation</p><blockquote className="border-l-2 border-border pl-3">{snapshot.permission.statement}</blockquote><p className="break-words text-xs text-muted-foreground">Poster account {snapshot.permission.posterId} · Confirmed {date(snapshot.permission.confirmedAt)}</p></div>
      : <p className="text-sm">This revision has no poster authorization confirmation. Return it for correction so the poster can submit a fresh permissioned version.</p>}
    {snapshot.evidence ? <div className="space-y-2 border-t border-border pt-4 text-sm"><p className="font-medium">Last recorded permission check · {date(snapshot.evidence.checkedAt)}</p><p className="whitespace-pre-wrap break-words">Reference: {snapshot.evidence.sourceReference}</p><p className="whitespace-pre-wrap break-words">{snapshot.evidence.verificationNote}</p>{snapshot.evidence.offerVersion !== snapshot.version ? <p className="text-xs text-muted-foreground">Recorded against version {snapshot.evidence.offerVersion}. Review the current version separately.</p> : null}</div> : null}
    <p className="text-sm text-muted-foreground">Inspect supplied written authorization or an existing permissioned business record. Public shop information can support the offer details; it does not establish this poster’s authority. This record stays private and does not approve or publish the offer.</p>
    {complete ? <p role="status" className="text-sm font-medium text-forest">Permission evidence recorded for this revision. The offer remains private. Reload to inspect the stored record.</p> : snapshot.permission ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void record(); }}>
      <fieldset disabled={locked} className="space-y-4">
        <legend className="sr-only">Authorization evidence</legend>
        <label className="grid gap-2 text-sm font-medium">Evidence type<select className={control} value={kind} onChange={(event) => { setKind(event.target.value as typeof kind); edited(); }}><option value="written_authorization">Supplied written authorization</option><option value="existing_business_permission">Existing permissioned business record</option></select></label>
        <label className="grid gap-2 text-sm font-medium">Authorization reference<input className={control} value={reference} maxLength={1000} onChange={(event) => { setReference(event.target.value); edited(); }} aria-describedby="permission-reference-help" /></label>
        <p id="permission-reference-help" className="text-xs text-muted-foreground">Record a private document, case or existing permission record reference. Do not paste passwords, access tokens or private signed links.</p>
        <label className="grid gap-2 text-sm font-medium">Verification note<textarea className={`${control} min-h-28 resize-y`} value={note} maxLength={2000} onChange={(event) => { setNote(event.target.value); edited(); }} /></label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-selection" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{PERMISSION_REVIEW_STATEMENT}</span></label>
      </fieldset>
      <Button type="submit" className="min-h-11" disabled={locked || !confirmed || !reference.trim() || !note.trim()}>{pending ? "Recording…" : "Record permission evidence"}</Button>
    </form> : null}
    {error ? <div role="alert" className="space-y-3 text-sm text-destructive"><p>{error}</p>{nextPath ? <Link href={nextPath} className="underline">Resolve account access</Link> : null}</div> : null}
    {blocked || complete ? <div className="space-y-2 text-sm"><p className="text-muted-foreground">Copy any text you need to keep before loading the current submission.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Load current permission review</Button></div> : null}
  </section>;
}
