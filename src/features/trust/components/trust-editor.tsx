"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { BlogMarkdown } from "@/features/blog/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { approveTrustVersion, createTrustDraft, publishTrustVersion, rollbackTrustVersion, saveTrustDraft, submitTrustVersion } from "../admin-actions";
import type { PolicyVersion, TrustDocument } from "../types";

export function TrustEditor({ document, version, isOwner }: { document: TrustDocument; version: PolicyVersion; isOwner: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [bodyMarkdown, setBodyMarkdown] = useState(version.bodyMarkdown);
  const [changeSummary, setChangeSummary] = useState(version.changeSummary);
  const [requiresReacceptance, setRequiresReacceptance] = useState(version.requiresReacceptance);
  const [reviewer, setReviewer] = useState(version.externalReviewerName ?? "");
  const [reference, setReference] = useState(version.counselReference ?? "");
  const [reviewedAt, setReviewedAt] = useState(version.reviewedAt?.slice(0, 16) ?? "");
  const [rollbackReacceptance, setRollbackReacceptance] = useState(false);
  const editable = version.status === "draft" || version.status === "in_review";

  function run(work: () => Promise<{ success: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await work();
      if (!result.success) {
        toast.error(result.error ?? "The action failed.");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.8fr)]">
      <section className="rounded-xl border border-border bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-ink">Version {version.version}</h2><p className="mt-1 text-sm text-muted-foreground">Status: {version.status.replaceAll("_", " ")}</p></div>{!editable ? <Button variant="outline" disabled={pending} onClick={() => run(() => createTrustDraft(document.id), "New draft created")}>Create next version</Button> : null}</div>
        <label className="mt-5 block text-xs font-semibold text-muted-foreground">Change summary<Input className="mt-1" value={changeSummary} disabled={!editable} onChange={(event) => setChangeSummary(event.target.value)} /></label>
        <label className="mt-4 block text-xs font-semibold text-muted-foreground">Policy Markdown<Textarea className="mt-1 min-h-[32rem] resize-y font-mono text-sm leading-6" value={bodyMarkdown} disabled={!editable} onChange={(event) => setBodyMarkdown(event.target.value)} /></label>
        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-medium text-ink"><input type="checkbox" checked={requiresReacceptance} disabled={!editable} onChange={(event) => setRequiresReacceptance(event.target.checked)} className="size-4" />Require existing users to accept this version</label>
        {editable ? <div className="mt-4 flex flex-wrap gap-2"><Button disabled={pending} onClick={() => run(() => saveTrustDraft({ id: version.id, bodyMarkdown, changeSummary, requiresReacceptance }), "Draft saved")}>Save draft</Button>{version.status === "draft" ? <Button variant="outline" disabled={pending} onClick={() => run(() => submitTrustVersion(version.id), "Submitted for review")}>Submit for review</Button> : null}</div> : null}

        {isOwner && version.status === "in_review" ? <div className="mt-7 border-t border-border pt-5"><h3 className="font-semibold text-ink">Counsel approval</h3><p className="mt-1 text-sm text-muted-foreground">Approval is invalid without an external reviewer and reference.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-muted-foreground">Reviewer<Input className="mt-1" value={reviewer} onChange={(event) => setReviewer(event.target.value)} /></label><label className="text-xs font-semibold text-muted-foreground">Review date<Input className="mt-1" type="datetime-local" value={reviewedAt} onChange={(event) => setReviewedAt(event.target.value)} /></label></div><label className="mt-3 block text-xs font-semibold text-muted-foreground">Counsel reference<Input className="mt-1" value={reference} onChange={(event) => setReference(event.target.value)} /></label><Button className="mt-4" disabled={pending || !reviewer || !reference || !reviewedAt} onClick={() => run(() => approveTrustVersion({ id: version.id, externalReviewerName: reviewer, counselReference: reference, reviewedAt: new Date(reviewedAt).toISOString() }), "Counsel approval recorded")}>Approve version</Button></div> : null}
        {isOwner && version.status === "approved" ? <div className="mt-7 border-t border-border pt-5"><h3 className="font-semibold text-ink">Publication gate</h3><p className="mt-1 text-sm text-muted-foreground">Publishing makes this version public and supersedes the current version.</p><Button className="mt-4" disabled={pending} onClick={() => run(() => publishTrustVersion(version.id), "Policy published")}>Publish approved version</Button></div> : null}
        {isOwner && version.status === "superseded" ? <div className="mt-7 border-t border-border pt-5"><h3 className="font-semibold text-ink">Restore this version</h3><p className="mt-1 text-sm text-muted-foreground">Restoring creates and publishes a new immutable version with this historical content.</p><label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-medium text-ink"><input type="checkbox" className="size-4" checked={rollbackReacceptance} onChange={(event) => setRollbackReacceptance(event.target.checked)} />Require existing users to accept the restored policy</label><Button className="mt-3" variant="destructive" disabled={pending} onClick={() => run(() => rollbackTrustVersion({ versionId: version.id, requiresReacceptance: rollbackReacceptance }), "Historical version restored")}>Restore as new version</Button></div> : null}
      </section>
      <section className="min-w-0 rounded-xl border border-border bg-background p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{document.title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{document.summary}</p><BlogMarkdown markdown={bodyMarkdown} className="mt-8" /></section>
    </div>
  );
}
