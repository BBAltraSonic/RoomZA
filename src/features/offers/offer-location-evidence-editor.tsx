"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { safeRedirectPath } from "@/lib/redirects";
import { useWorkspaceReady } from "./use-workspace-ready";
import { LOCATION_REVIEW_VERSION, locationReviewChecks, type LocationReviewSnapshot } from "./location-review-contract";

const control = "min-h-11 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const date = (value: string) => new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(value));
const unchecked = { provenanceChecked: false, shopChecked: false, contentChecked: false, datesChecked: false };
export function OfferLocationEvidenceEditor({ snapshot }: { snapshot: LocationReviewSnapshot }) {
  const ready = useWorkspaceReady();
  const busy = useRef(false), requestId = useRef<string | null>(null);
  const [provenance, setProvenance] = useState("");
  const [shop, setShop] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(unchecked);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [nextPath, setNextPath] = useState<string>();
  const locked = !ready || pending || blocked || complete;
  const allChecked = locationReviewChecks.every(({ key }) => confirmed[key]);
  function edited() { requestId.current = null; setConfirmed(unchecked); }
  async function record() {
    if (busy.current || blocked || complete || !snapshot.place || !snapshot.permissionReviewId) return;
    if (!allChecked || !provenance.trim() || !shop.trim() || !note.trim()) { setError("Add both source references, a verification note and all four confirmations."); return; }
    busy.current = true; setPending(true); setError(""); setNextPath(undefined);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/private/offers/location-evidence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        offerId: snapshot.offerId, revisionId: snapshot.revisionId, expectedVersion: snapshot.version, requestId: requestId.current,
        permissionReviewId: snapshot.permissionReviewId, placeSnapshot: snapshot.place,
        provenanceReference: provenance, shopReference: shop, verificationNote: note, ...confirmed, statementVersion: LOCATION_REVIEW_VERSION,
      }) });
      const body = await response.json();
      if (!response.ok) {
        const message = typeof body.error === "string" ? body.error : body.error?.message;
        setError(typeof message === "string" ? message : "Could not record the review. Your text is still here.");
        if (typeof body.nextPath === "string") setNextPath(safeRedirectPath(body.nextPath, "/admin/offers"));
        else if (body.error?.code === "account_suspended") setNextPath("/account-suspended");
        else if (response.status === 401) setNextPath(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
        setBlocked(true); return;
      }
      setComplete(true);
    } catch { setError("Connection interrupted. Your evidence text is still here. Load the current review before retrying."); setBlocked(true); }
    finally { busy.current = false; setPending(false); }
  }
  const canRecord = snapshot.place && snapshot.permissionReviewId;
  return <section aria-labelledby="location-evidence-title" className="max-w-3xl space-y-5 rounded-xl border border-border p-5">
    <h2 id="location-evidence-title" className="text-lg font-semibold">Place, shop and date review</h2>
    {snapshot.place ? <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {[["Stored place", `${snapshot.place.name}, ${snapshot.place.region}`], ["Provider reference", snapshot.place.provider_id],
        ["Catalogue address", snapshot.place.full_address], ["Place level", snapshot.place.level],
        ["Catalogue centre", `${snapshot.place.center_lat}, ${snapshot.place.center_lng}`], ["Submitted shop point", `${snapshot.content.latitude}, ${snapshot.content.longitude}`],
        ["Catalogue bounds", `${snapshot.place.west}, ${snapshot.place.south} → ${snapshot.place.east}, ${snapshot.place.north}`]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
    </dl> : <p className="text-sm">The stored place is missing. Return the submission for correction.</p>}
    <p className="text-sm text-muted-foreground">Inspect the source evidence for this South African place and the submitted shop, address, exact point, benefit, terms and dates shown above. Being inside the catalogue bounds is a consistency check; it does not verify provenance or the shop point. These references stay private. Recording this review does not approve or publish the offer.</p>
    {snapshot.evidence ? <div className="space-y-2 border-t border-border pt-4 text-sm">
      <p className="font-medium">Last recorded place, shop and date check · {date(snapshot.evidence.checkedAt)}</p>
      <p className="break-words text-xs text-muted-foreground">Reviewer account {snapshot.evidence.reviewerId} · Recorded version {snapshot.evidence.offerVersion}</p>
      <p className="whitespace-pre-wrap break-words">Place source: {snapshot.evidence.provenanceReference}</p>
      <p className="whitespace-pre-wrap break-words">Shop source: {snapshot.evidence.shopReference}</p>
      <p className="whitespace-pre-wrap break-words">{snapshot.evidence.verificationNote}</p>
      {snapshot.evidence.offerVersion !== snapshot.version || JSON.stringify(snapshot.evidence.placeSnapshot) !== JSON.stringify(snapshot.place) ? <p className="text-xs text-muted-foreground">The current offer version or catalogue row differs from this recorded check. Review the current facts separately.</p> : null}
    </div> : null}
    {complete ? <p role="status" className="text-sm font-medium text-forest">Place, shop and date evidence recorded for this revision. The offer remains private. Reload to inspect the stored record.</p> : canRecord ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void record(); }}>
      <fieldset disabled={locked} className="space-y-4">
        <legend className="sr-only">Place, shop and date evidence</legend>
        <label className="grid gap-2 text-sm font-medium">Place provenance reference<input className={control} value={provenance} maxLength={1000} onChange={(event) => { setProvenance(event.target.value); edited(); }} aria-describedby="location-reference-help" /></label>
        <label className="grid gap-2 text-sm font-medium">Shop and offer source reference<input className={control} value={shop} maxLength={1000} onChange={(event) => { setShop(event.target.value); edited(); }} aria-describedby="location-reference-help" /></label>
        <p id="location-reference-help" className="text-xs text-muted-foreground">Record source or case references covering these facts. Do not paste passwords, access tokens or private signed links.</p>
        <label className="grid gap-2 text-sm font-medium">Place, shop and date verification note<textarea className={`${control} min-h-28 resize-y`} value={note} maxLength={2000} onChange={(event) => { setNote(event.target.value); edited(); }} /></label>
        {locationReviewChecks.map(({ key, text }) => <label key={key} className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-selection" checked={confirmed[key]} onChange={(event) => setConfirmed({ ...confirmed, [key]: event.target.checked })} /><span>{text}</span></label>)}
      </fieldset>
      <Button type="submit" className="min-h-11" disabled={locked || !allChecked || !provenance.trim() || !shop.trim() || !note.trim()}>{pending ? "Recording…" : "Record place, shop and date evidence"}</Button>
    </form> : <div className="space-y-3 text-sm"><p>Record permission evidence for this current revision first, then reload to review the place and shop facts.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Load current place review</Button></div>}
    {error ? <div role="alert" className="space-y-3 text-sm text-destructive"><p>{error}</p>{nextPath ? <Link href={nextPath} className="underline">Resolve account access</Link> : null}</div> : null}
    {blocked || complete ? <div className="space-y-2 text-sm"><p className="text-muted-foreground">Copy any text you need to keep before loading the current review.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Load current place review</Button></div> : null}
  </section>;
}
