"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LocationSelector } from "@/features/map-discovery/location-selector";
import { parseOfferSubmission, type OfferDraft } from "./schema";
import { draftFormValues, formOfferDraft, offerFormError, type OfferFormValues } from "./offer-draft-form";
import { privateOfferStatus, type OfferWorkspaceDetail, type OfferWriteRequest } from "./workspace-contract";
import { requestOfferWorkspace } from "./workspace-request";
import { useWorkspaceReady } from "./use-workspace-ready";
import { OFFER_PERMISSION_STATEMENT, OFFER_PERMISSION_VERSION } from "./permission-contract";

const control = "min-h-11 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labels: Record<keyof OfferFormValues, string> = {
  title: "Offer title", benefit: "Benefit", terms: "Exact terms", shopName: "Shop name", address: "Public shop address",
  latitude: "Shop latitude", longitude: "Shop longitude", startsAt: "Starts at (South Africa)", endsAt: "Ends at (South Africa)",
};
const textLimits = { title: 160, benefit: 500, terms: 4000, shopName: 160, address: 500 };

function OfferPreview({ draft }: { draft: OfferDraft }) {
  return <dl className="grid gap-3 text-sm sm:grid-cols-2">
    {(["title", "benefit", "terms", "shopName", "address", "latitude", "longitude", "startsAt", "endsAt"] as const).map((key) => <div key={key} className={key === "terms" ? "sm:col-span-2" : ""}>
      <dt className="text-muted-foreground">{labels[key]}</dt>
      <dd className="whitespace-pre-wrap break-words font-medium text-ink">{draft[key] === undefined ? "Not added" : key === "startsAt" || key === "endsAt" ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(draft[key]!)) : String(draft[key])}</dd>
    </div>)}
  </dl>;
}

export function OfferDraftEditor({ detail }: { detail: OfferWorkspaceDetail }) {
  const router = useRouter();
  const ready = useWorkspaceReady();
  const [offer, setOffer] = useState(detail.offer);
  const [values, setValues] = useState(() => draftFormValues(detail.offer.draft));
  const [areaId, setAreaId] = useState<string | null>(detail.offer.draft.areaId ?? null);
  const [placeLabel, setPlaceLabel] = useState(detail.placeLabel);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [nextPath, setNextPath] = useState<string>();
  const [preview, setPreview] = useState<OfferDraft | null>(null);
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false);
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const busy = useRef(false);
  // Keep the same revision ID after an uncertain HTTP outcome; DB retries deduplicate it.
  const submissionId = useRef<string | null>(null);
  const versionChanged = detail.offer.version > offer.version;
  const statusOffer = detail.offer.version >= offer.version ? detail.offer : offer;
  const locked = !ready || pending || blocked || versionChanged;

  async function mutate(command: "save" | "submit" | "withdraw") {
    if (busy.current || blocked || versionChanged) return;
    busy.current = true; setPending(true); setMessage(""); setError(""); setNextPath(undefined);
    try {
      let request: OfferWriteRequest;
      let draft = offer.draft;
      if (command === "save") {
        draft = formOfferDraft(values, areaId);
        request = { command, offerId: offer.id, expectedVersion: offer.version, draft };
      } else if (command === "submit") {
        if (dirty) throw new Error("Save your changes before submitting.");
        if (!permissionConfirmed) throw new Error("Confirm your shop authorization before submitting.");
        parseOfferSubmission(offer.draft, Date.now());
        submissionId.current ??= crypto.randomUUID();
        request = { command, offerId: offer.id, expectedVersion: offer.version, revisionId: submissionId.current, permissionConfirmed: true, permissionVersion: OFFER_PERMISSION_VERSION };
      } else request = { command, offerId: offer.id, expectedVersion: offer.version };
      const result = await requestOfferWorkspace(request);
      if (!result.ok) {
        setError(result.message); setNextPath(result.nextPath);
        if (result.status === 409 || result.status === 401 || result.status === 403) setBlocked(true);
        return;
      }
      setOffer((previous) => ({ ...previous, version: result.data.version, pendingRevisionId: result.data.pendingRevisionId,
        draft, withdrawnAt: command === "withdraw" ? new Date().toISOString() : command === "submit" ? null : previous.withdrawnAt }));
      if (command === "save") { setDirty(false); submissionId.current = null; }
      setPermissionConfirmed(false);
      if (command === "withdraw") setConfirmWithdrawal(false);
      setMessage(command === "save" ? "Private draft saved." : command === "submit" ? "Submitted for admin confirmation. This offer is not public." : "Offer withdrawn. Pending review has been cancelled.");
      // Refresh the server-observed snapshot/history while retaining this form's text.
      router.refresh();
    } catch (caught) { setError(offerFormError(caught)); }
    finally { busy.current = false; setPending(false); }
  }

  return <div className="space-y-8">
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="rounded-full border border-border bg-muted px-3 py-1 font-medium">{privateOfferStatus(statusOffer)}</span>
      <span className="text-muted-foreground">Version {offer.version}{dirty ? " · Unsaved changes" : ""}</span>
    </div>
    {versionChanged ? <div role="alert" className="space-y-2 text-sm"><p>This offer changed. Your draft text is still here. Load the current version before saving or submitting.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Load latest version</Button></div> : null}
    <p className="max-w-prose text-sm text-muted-foreground">Add a public shop location, benefit and exact terms. Save your draft, preview it, then submit it for admin confirmation. Times use South Africa time (UTC+02:00).</p>
    {detail.history.find((event) => event.action === "reject")?.reason ? <p className="rounded-xl border border-border bg-muted p-4 text-sm">Previous admin correction: {detail.history.find((event) => event.action === "reject")?.reason}</p> : null}
    <form onSubmit={(event) => { event.preventDefault(); void mutate("save"); }} className="space-y-7">
      <fieldset disabled={locked} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-lg font-semibold">Offer and shop</legend>
        {(["title", "benefit", "terms", "shopName", "address"] as const).map((key) => <label key={key} className={`grid gap-2 text-sm font-medium ${key === "terms" || key === "benefit" || key === "address" ? "sm:col-span-2" : ""}`}>
          {labels[key]}
          {key === "terms" || key === "benefit" ? <textarea className={`${control} min-h-28 resize-y`} name={key} value={values[key]} maxLength={textLimits[key]} onChange={(event) => { setValues({ ...values, [key]: event.target.value }); setDirty(true); }} />
            : <input className={control} name={key} value={values[key]} maxLength={textLimits[key]} onChange={(event) => { setValues({ ...values, [key]: event.target.value }); setDirty(true); }} />}
        </label>)}
      </fieldset>
      <fieldset disabled={locked} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-lg font-semibold">Public location</legend>
        <div className="space-y-2 sm:col-span-2">
          <p className="text-sm font-medium">South African place</p>
          <LocationSelector idPrefix="offer-place" searchUrl="/api/private/offers/places" selectedLocation={placeLabel} onSelect={(place) => { setAreaId(place.id); setPlaceLabel(`${place.label}, ${place.secondaryLabel}`); setDirty(true); }} />
          <p className="text-xs text-muted-foreground">Search places already in the catalogue. Choose one, then enter the shop’s exact public coordinates. The centre of the place is not the shop point.</p>
        </div>
        {(["latitude", "longitude"] as const).map((key) => <label key={key} className="grid gap-2 text-sm font-medium">{labels[key]}<input className={control} name={key} type="number" step="any" min={key === "latitude" ? -90 : -180} max={key === "latitude" ? 90 : 180} value={values[key]} onChange={(event) => { setValues({ ...values, [key]: event.target.value }); setDirty(true); }} /></label>)}
      </fieldset>
      <fieldset disabled={locked} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-lg font-semibold">Validity</legend>
        {(["startsAt", "endsAt"] as const).map((key) => <label key={key} className="grid gap-2 text-sm font-medium">{labels[key]}<input className={`${control} min-w-0`} type="datetime-local" step="1" name={key} value={values[key]} onChange={(event) => { setValues({ ...values, [key]: event.target.value }); setDirty(true); }} /></label>)}
      </fieldset>
      <label className="flex max-w-prose items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-forest" checked={permissionConfirmed} disabled={locked || dirty || Boolean(offer.pendingRevisionId)} onChange={(event) => setPermissionConfirmed(event.target.checked)} />
        <span>{OFFER_PERMISSION_STATEMENT}<span className="mt-1 block text-xs text-muted-foreground">Confirm for this saved version. An admin will check separate permission evidence before publication.</span></span>
      </label>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="min-h-11" disabled={locked}>{pending ? "Please wait…" : "Save private draft"}</Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={!ready || pending} onClick={() => { try { setPreview(formOfferDraft(values, areaId)); setError(""); } catch (caught) { setError(offerFormError(caught)); } }}>Preview draft</Button>
        <Button type="button" variant="secondary" className="min-h-11" disabled={locked || dirty || !permissionConfirmed || Boolean(offer.pendingRevisionId)} onClick={() => void mutate("submit")}>Submit for confirmation</Button>
      </div>
      {dirty ? <p className="text-xs text-muted-foreground">Save these changes before submitting.</p> : null}
    </form>
    <div aria-live="polite" role="status" className="text-sm text-forest">{message}</div>
    {error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p>{nextPath ? <Link href={nextPath} className="underline">Continue to your account</Link> : null}</div> : null}
    {blocked ? <div className="space-y-3 rounded-xl border border-border bg-muted p-4 text-sm"><p>Copy any unsaved text you need to keep. Loading the latest version replaces this form; it never saves your current text over another edit.</p><Button variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Load latest version</Button></div> : null}
    {preview ? <section aria-label="Private draft preview" className="space-y-4 border-y border-border py-5"><h2 className="text-lg font-semibold">Private draft preview</h2><p className="text-sm text-muted-foreground">{placeLabel || "No place selected"}. This preview does not publish the offer.</p><OfferPreview draft={preview} /></section> : null}
    {detail.submission ? <section className="space-y-4 border-t border-border pt-5"><h2 className="text-lg font-semibold">Last submitted snapshot</h2><p className="text-sm text-muted-foreground">Later draft saves do not change this submitted version. Reload to see new submissions and admin decisions.</p><OfferPreview draft={detail.submission.content} /></section> : null}
    {!offer.withdrawnAt ? <section className="space-y-3 border-t border-border pt-5"><h2 className="text-lg font-semibold">Withdraw offer</h2><p className="text-sm text-muted-foreground">Cancel the pending review. Keep the draft and history for a fresh submission.</p>{confirmWithdrawal ? <div className="flex flex-wrap gap-3"><Button variant="destructive" className="min-h-11" disabled={locked} onClick={() => void mutate("withdraw")}>Confirm withdrawal</Button><Button variant="outline" className="min-h-11" disabled={pending} onClick={() => setConfirmWithdrawal(false)}>Keep offer</Button></div> : <Button variant="outline" className="min-h-11" disabled={locked} onClick={() => setConfirmWithdrawal(true)}>Withdraw offer</Button>}</section> : null}
    <section className="space-y-3 border-t border-border pt-5"><h2 className="text-lg font-semibold">Recent history</h2><ol className="divide-y divide-border text-sm">{detail.history.map((event) => <li key={event.id} className="space-y-1 py-3"><span className="font-medium capitalize">{event.action}</span><span className="ml-3 text-muted-foreground">Version {event.version} · {new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }).format(new Date(event.occurredAt))}</span>{event.reason ? <p className="whitespace-pre-wrap break-words">{event.reason}</p> : null}</li>)}</ol></section>
  </div>;
}
