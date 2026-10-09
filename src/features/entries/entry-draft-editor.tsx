"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LocationSelector } from "@/features/map-discovery/location-selector";
import { useWorkspaceReady } from "@/features/offers/use-workspace-ready";
import { formatEntryTimeSast, parseEntrySubmission, type EntryCategory, type EntryDraft } from "./schema";
import { entryDraftFormValues, entryFormError, formEntryDraft, type EntryFormValues } from "./entry-draft-form";
import type { EntryWorkspaceDetail } from "./workspace-data";
import { requestEntryWorkspace } from "./workspace-request";
import type { EntryIntakeCommand } from "./intake-contract";
import { EntryPermissionConfirmation } from "./entry-permission-confirmation";

const categoryName = { tourism: "Tourism", event: "Event" } as const;
const control = "min-h-11 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labels: Record<keyof EntryFormValues, string> = {
  title: "Entry title", description: "Description", venueName: "Venue name", address: "Street address",
  latitude: "Venue latitude", longitude: "Venue longitude", startsAt: "Starts at (SAST)", endsAt: "Ends at (SAST)",
};

function EntryPreview({ draft }: { draft: EntryDraft }) {
  return <dl className="grid gap-3 text-sm sm:grid-cols-2">
    {(["title", "description", "venueName", "address", "latitude", "longitude", "startsAt", "endsAt"] as const).map((key) => <div key={key} className={key === "description" || key === "address" ? "sm:col-span-2" : ""}>
      <dt className="text-muted-foreground">{labels[key]}</dt>
      <dd className="whitespace-pre-wrap break-words font-medium text-ink">{draft[key] === undefined ? "Not added" : key === "startsAt" || key === "endsAt" ? formatEntryTimeSast(draft[key]!) : String(draft[key])}</dd>
    </div>)}
  </dl>;
}

function sastTime(value: string) {
  const instant = Date.parse(value);
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short", hour12: false }).format(instant) + " SAST";
}

export function EntryDraftEditor({ detail, category }: { detail: EntryWorkspaceDetail; category: EntryCategory }) {
  const router = useRouter();
  const ready = useWorkspaceReady();
  const [entry, setEntry] = useState(detail.entry);
  const [values, setValues] = useState(() => entryDraftFormValues(detail.entry.draft));
  const [areaId, setAreaId] = useState<string | null>(detail.entry.draft.areaId ?? null);
  const [placeLabel, setPlaceLabel] = useState(detail.placeLabel);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [nextPath, setNextPath] = useState<string>();
  const [preview, setPreview] = useState<EntryDraft | null>(null);
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false);
  const busyRef = useRef(false);
  const submissionId = useRef<string | null>(null);
  const versionChanged = detail.entry.version > entry.version;
  const locked = !ready || busy || blocked || versionChanged;

  async function mutate(kind: "save" | "submit" | "withdraw") {
    if (busyRef.current || blocked || versionChanged) return;
    busyRef.current = true; setBusy(true); setError(""); setMessage(""); setNextPath(undefined);
    try {
      let draft = entry.draft;
      let command: EntryIntakeCommand;
      if (kind === "save") {
        draft = formEntryDraft(values, areaId);
        command = { command: "save", entryId: entry.id, category, expectedVersion: entry.version, draft };
      } else if (kind === "submit") {
        if (dirty) throw new Error("Save your changes before submitting.");
        parseEntrySubmission(entry.draft, Date.now());
        submissionId.current ??= crypto.randomUUID();
        command = { command: "submit", entryId: entry.id, category, expectedVersion: entry.version, revisionId: submissionId.current };
      } else command = { command: "withdraw", entryId: entry.id, category, expectedVersion: entry.version };
      const result = await requestEntryWorkspace(command);
      if (!result.ok) {
        setError(result.message); setNextPath(result.nextPath);
        if (result.status === 409 || result.status === 401 || result.status === 403) setBlocked(true);
        return;
      }
      setEntry((previous) => ({ ...previous, version: result.data.version, pendingRevisionId: result.data.pendingRevisionId,
        draft, withdrawnAt: kind === "withdraw" ? new Date().toISOString() : kind === "submit" ? null : previous.withdrawnAt }));
      if (kind === "save") { setDirty(false); submissionId.current = null; }
      if (kind === "withdraw") setConfirmWithdrawal(false);
      setMessage(kind === "save" ? "Private draft saved." : kind === "submit" ? "Submitted for admin review. This entry is not public." : "Entry withdrawn. The pending review was cancelled.");
      router.refresh();
    } catch (caught) { setError(entryFormError(caught)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return <div className="space-y-8">
    <div className="flex flex-wrap items-center gap-3 text-sm"><span className="rounded-full border border-border bg-muted px-3 py-1 font-medium">{entry.withdrawnAt ? "Withdrawn" : entry.pendingRevisionId ? "Awaiting admin review" : "Private draft"}</span><span className="text-muted-foreground">Version {entry.version}{dirty ? " · Unsaved changes" : ""}</span></div>
    <p className="max-w-prose text-sm text-muted-foreground">Add the venue and exact continuous availability window. Times are entered in South African Standard Time (UTC+02:00) and stored in UTC. Submitted revisions are private until separate review and publication checks are complete.</p>
    {versionChanged ? <div role="alert" className="space-y-2 text-sm"><p>This entry changed. Your draft text is still here. Load the current version before saving or submitting.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Load latest version</Button></div> : null}
    <form onSubmit={(event) => { event.preventDefault(); void mutate("save"); }} className="space-y-7">
      <fieldset disabled={locked} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-lg font-semibold">{categoryName[category]} details</legend>
        {(["title", "description", "venueName"] as const).map((key) => <label key={key} className={`grid gap-2 text-sm font-medium ${key === "description" ? "sm:col-span-2" : ""}`}>
          {labels[key]}{key === "description" ? <textarea className={`${control} min-h-32 resize-y`} name={key} value={values[key]} maxLength={4000} onChange={(event) => { setValues({ ...values, [key]: event.target.value }); setDirty(true); }} />
            : <input className={control} name={key} value={values[key]} maxLength={key === "title" ? 160 : 160} onChange={(event) => { setValues({ ...values, [key]: event.target.value }); setDirty(true); }} />}
        </label>)}
      </fieldset>
      <fieldset disabled={locked} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-lg font-semibold">Venue</legend>
        <div className="space-y-2 sm:col-span-2"><p className="text-sm font-medium">Catalogue place</p>
          <LocationSelector idPrefix={`entry-place-${category}`} searchUrl="/api/private/offers/places" selectedLocation={placeLabel} onSelect={(place) => { setAreaId(place.id); setPlaceLabel(`${place.label}, ${place.secondaryLabel}`); setDirty(true); }} />
          <p className="max-w-prose text-xs text-muted-foreground">Choose the area containing the venue, then enter its street address and coordinates. Catalogue selection does not verify the venue or grant publication permission.</p>
        </div>
        <label className="grid gap-2 text-sm font-medium sm:col-span-2">{labels.address}<input className={control} name="address" value={values.address} maxLength={500} onChange={(event) => { setValues({ ...values, address: event.target.value }); setDirty(true); }} /></label>
        {(["latitude", "longitude"] as const).map((key) => <label key={key} className="grid gap-2 text-sm font-medium">{labels[key]}<input className={control} name={key} type="number" step="any" min={key === "latitude" ? -90 : -180} max={key === "latitude" ? 90 : 180} value={values[key]} onChange={(event) => { setValues({ ...values, [key]: event.target.value }); setDirty(true); }} /></label>)}
      </fieldset>
      <fieldset disabled={locked} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-lg font-semibold">Availability window</legend>
        {(["startsAt", "endsAt"] as const).map((key) => <label key={key} className="grid gap-2 text-sm font-medium">{labels[key]}<input className={`${control} min-w-0`} type="datetime-local" step="1" name={key} value={values[key]} onChange={(event) => { setValues({ ...values, [key]: event.target.value }); setDirty(true); }} /></label>)}
        <p className="text-xs text-muted-foreground sm:col-span-2">Use one continuous range. The end must be after the start and still in the future when you submit.</p>
      </fieldset>
      <div className="flex flex-wrap gap-3"><Button type="submit" className="min-h-11" disabled={locked}>{busy ? "Please wait…" : "Save private draft"}</Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={!ready || busy} onClick={() => { try { setPreview(formEntryDraft(values, areaId)); setError(""); } catch (caught) { setError(entryFormError(caught)); } }}>Preview draft</Button>
        <Button type="button" variant="secondary" className="min-h-11" disabled={locked || dirty || Boolean(entry.pendingRevisionId)} onClick={() => void mutate("submit")}>Submit for review</Button>
      </div>
      {dirty ? <p className="text-xs text-muted-foreground">Save these changes before submitting.</p> : null}
    </form>
    <div aria-live="polite" role="status" className="text-sm text-forest">{message}</div>
    {error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p>{nextPath ? <Link className="underline" href={nextPath}>Continue to your account</Link> : null}</div> : null}
    {blocked ? <div className="space-y-3 rounded-xl border border-border bg-muted p-4 text-sm"><p>Your text is still in this form. Load the latest version to continue; it will replace these unsaved values.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Load latest version</Button></div> : null}
    {preview ? <section aria-label="Private entry preview" className="space-y-4 border-y border-border py-5"><h2 className="text-lg font-semibold">Private draft preview</h2><p className="text-sm text-muted-foreground">{placeLabel || "No catalogue place selected"}. Preview does not publish this entry.</p><EntryPreview draft={preview} /></section> : null}
    {detail.publication ? <section aria-label="Publication status" className="space-y-2"><h2 className="text-lg font-semibold">Publication status</h2><p className="text-sm">{detail.publication.state === "available" ? "Approved and available." : detail.publication.state === "scheduled" ? category === "event" ? "Approved Upcoming event; visible until its end time." : "Approved; it will appear when its availability starts." : detail.publication.state === "ended" ? "Ended; hidden from discovery." : detail.publication.state === "unpublished" ? "Unpublished by an administrator." : detail.publication.state === "awaiting_review" ? "Awaiting approval; this revision is private." : detail.publication.state === "withdrawn" ? "Withdrawn; hidden from discovery." : "Private draft."}</p>{detail.publication.correction?<p className="whitespace-pre-wrap text-sm">Last reviewer feedback: {detail.publication.correction}</p>:null}</section>:null}
    {detail.submission ? <section className="space-y-4 border-t border-border pt-5"><h2 className="text-lg font-semibold">Submitted revision</h2><p className="text-sm text-muted-foreground">Submitted {sastTime(detail.submission.submittedAt)}. Later draft saves do not change this snapshot. Publication status is shown above.</p><EntryPreview draft={detail.submission.content} /></section> : null}
    {entry.pendingRevisionId && detail.submission?.id === entry.pendingRevisionId && !blocked && !versionChanged ? <EntryPermissionConfirmation key={entry.pendingRevisionId} entryId={entry.id} category={category} revisionId={entry.pendingRevisionId} version={entry.version} confirmed={detail.publication?.permissionConfirmed ?? false}/> : null}
    {!entry.withdrawnAt ? <section className="space-y-3 border-t border-border pt-5"><h2 className="text-lg font-semibold">Withdraw entry</h2><p className="text-sm text-muted-foreground">Cancel any pending review and keep the private draft and history.</p>{confirmWithdrawal ? <div className="flex flex-wrap gap-3"><Button type="button" variant="destructive" className="min-h-11" disabled={locked} onClick={() => void mutate("withdraw")}>Confirm withdrawal</Button><Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setConfirmWithdrawal(false)}>Keep entry</Button></div> : <Button type="button" variant="outline" className="min-h-11" disabled={locked} onClick={() => setConfirmWithdrawal(true)}>Withdraw entry</Button>}</section> : null}
    <section className="space-y-3 border-t border-border pt-5"><h2 className="text-lg font-semibold">Recent activity</h2><ol className="divide-y divide-border text-sm">{detail.history.map((event) => <li key={event.id} className="py-3"><span className="font-medium capitalize">{event.action}</span><span className="ml-3 text-muted-foreground">Version {event.version} · {sastTime(event.occurredAt)}</span></li>)}</ol></section>
  </div>;
}
