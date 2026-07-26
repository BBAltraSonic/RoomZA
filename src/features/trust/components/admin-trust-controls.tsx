"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminMutation } from "@/features/admin/use-admin-mutation";

import { generateTransparencySnapshot, publishTransparencySnapshot, setListingReviewVerification, updatePrivacyRequest } from "../admin-actions";
import type { PrivacyRequestStatus } from "../types";

export function PrivacyRequestControls({ request }: { request: { id: string; request_type: string; status: PrivacyRequestStatus; resolution_note?: string | null; retention_decision?: Record<string, string> | null } }) {
  const [status, setStatus] = useState(request.status);
  const [resolutionNote, setResolutionNote] = useState(request.resolution_note ?? "");
  const [deleted, setDeleted] = useState(request.retention_decision?.deleted ?? "");
  const [anonymized, setAnonymized] = useState(request.retention_decision?.anonymized ?? "");
  const [retained, setRetained] = useState(request.retention_decision?.retained ?? "");
  const { pending, run } = useAdminMutation();
  return <section className="mt-5 rounded-xl border border-border bg-panel p-5"><h2 className="font-semibold text-ink">Request workflow</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-muted-foreground">Status<select className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value as PrivacyRequestStatus)}>{["submitted", "in_review", "waiting_on_user", "completed", "declined", "cancelled"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><label className="text-xs font-semibold text-muted-foreground">Resolution note<Textarea className="mt-1" value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} /></label></div>{request.request_type === "deletion" ? <div className="mt-5 border-t border-border pt-5"><h3 className="font-semibold text-ink">Retention checklist</h3><p className="mt-1 text-xs text-muted-foreground">All three fields are required before completing a deletion request.</p><div className="mt-3 grid gap-3"><label className="text-xs font-semibold text-muted-foreground">Deleted<Textarea className="mt-1" value={deleted} onChange={(event) => setDeleted(event.target.value)} /></label><label className="text-xs font-semibold text-muted-foreground">Anonymized<Textarea className="mt-1" value={anonymized} onChange={(event) => setAnonymized(event.target.value)} /></label><label className="text-xs font-semibold text-muted-foreground">Retained and lawful basis<Textarea className="mt-1" value={retained} onChange={(event) => setRetained(event.target.value)} /></label></div></div> : null}<Button className="mt-4" disabled={pending} onClick={() => run(() => updatePrivacyRequest({ id: request.id, status, resolutionNote: resolutionNote || null, retentionDecision: { deleted, anonymized, retained } }), "Privacy request updated")}>Save workflow</Button></section>;
}

export function VerificationControls() {
  const [listingId, setListingId] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [verified, setVerified] = useState(true);
  const { pending, run } = useAdminMutation();
  return <section className="mb-5 rounded-xl border border-border bg-panel p-5"><h2 className="font-semibold text-ink">Listing review signal</h2><p className="mt-1 text-sm text-muted-foreground">This signal does not assert identity or property ownership.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-muted-foreground">Listing ID<Input className="mt-1" value={listingId} onChange={(event) => setListingId(event.target.value)} /></label><label className="text-xs font-semibold text-muted-foreground">Outcome<select className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" value={verified ? "verified" : "revoked"} onChange={(event) => setVerified(event.target.value === "verified")}><option value="verified">Verified</option><option value="revoked">Revoked</option></select></label></div><label className="mt-3 block text-xs font-semibold text-muted-foreground">Evidence or decision context<Textarea className="mt-1" value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} /></label><Button className="mt-4" disabled={pending || !listingId || evidenceNote.trim().length < 10} onClick={() => run(() => setListingReviewVerification({ listingId, verified, evidenceNote }), verified ? "Listing review verified" : "Listing review revoked")}>Record signal</Button></section>;
}

export function TransparencyControls({ snapshots, isOwner }: { snapshots: { id: string; status: string }[]; isOwner: boolean }) {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState(first);
  const [periodEnd, setPeriodEnd] = useState(last);
  const { pending, run } = useAdminMutation();
  return <><section className="mb-5 rounded-xl border border-border bg-panel p-5"><h2 className="font-semibold text-ink">Generate monthly snapshot</h2><div className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="text-xs font-semibold text-muted-foreground">Period start<Input className="mt-1" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label><label className="text-xs font-semibold text-muted-foreground">Period end<Input className="mt-1" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label></div><Button className="mt-4" disabled={pending} onClick={() => run(() => generateTransparencySnapshot({ periodStart, periodEnd }), "Snapshot generated")}>Generate draft</Button></section>{isOwner ? <div className="mb-5 flex flex-wrap gap-2">{snapshots.filter((snapshot) => snapshot.status === "draft").map((snapshot) => <Button key={snapshot.id} variant="outline" disabled={pending} onClick={() => run(() => publishTransparencySnapshot(snapshot.id), "Snapshot published")}>Publish {snapshot.id.slice(0, 8)}</Button>)}</div> : null}</>;
}
