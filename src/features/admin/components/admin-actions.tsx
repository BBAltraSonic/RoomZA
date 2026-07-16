"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  addModerationCaseNote,
  createSensitiveAccessGrant,
  inviteOrPromoteAdmin,
  restoreAccount,
  restoreListing,
  restrictListing,
  retryNotification,
  resetAdminMfa,
  revokeAdminMembership,
  suspendAccount,
  updateModerationCase,
} from "../actions";
import type { ModerationPriority, ModerationStatus } from "../types";

function useAdminMutation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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
  return { pending, run };
}

export function CaseControls({ caseId, status, priority, assignedTo, resolutionNote }: { caseId: string; status: ModerationStatus; priority: ModerationPriority; assignedTo: string | null; resolutionNote: string | null }) {
  const [nextStatus, setNextStatus] = useState(status);
  const [nextPriority, setNextPriority] = useState(priority);
  const [assignee, setAssignee] = useState(assignedTo ?? "");
  const [resolution, setResolution] = useState(resolutionNote ?? "");
  const [note, setNote] = useState("");
  const { pending, run } = useAdminMutation();
  const isClosing = nextStatus === "resolved" || nextStatus === "dismissed";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-panel p-4">
        <h2 className="font-semibold text-ink">Case workflow</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted-foreground">Status<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as ModerationStatus)} className="mt-1 h-10 w-full rounded-lg bg-background px-3 text-sm shadow-[var(--neu-inset-sm)]"><option value="open">Open</option><option value="in_review">In review</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></label>
          <label className="text-xs font-semibold text-muted-foreground">Priority<select value={nextPriority} onChange={(event) => setNextPriority(event.target.value as ModerationPriority)} className="mt-1 h-10 w-full rounded-lg bg-background px-3 text-sm shadow-[var(--neu-inset-sm)]"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        </div>
        <label className="mt-3 block text-xs font-semibold text-muted-foreground">Assignee ID<Input className="mt-1" value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="Leave empty for unassigned" /></label>
        {isClosing ? <label className="mt-3 block text-xs font-semibold text-muted-foreground">Resolution note<Textarea className="mt-1" value={resolution} onChange={(event) => setResolution(event.target.value)} /></label> : null}
        <Button className="mt-4" disabled={pending} onClick={() => run(() => updateModerationCase({ caseId, status: nextStatus, priority: nextPriority, assignedTo: assignee || null, resolutionNote: isClosing ? resolution || null : null }), "Case updated")}>Save workflow</Button>
      </section>
      <section className="rounded-xl border border-border bg-panel p-4">
        <h2 className="font-semibold text-ink">Internal note</h2>
        <p className="mt-1 text-xs text-muted-foreground">Notes never appear in reporter notifications or exports.</p>
        <Textarea className="mt-4" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record the decision context" />
        <Button className="mt-3" variant="outline" disabled={pending || !note.trim()} onClick={() => run(async () => { const result = await addModerationCaseNote({ caseId, body: note }); if (result.success) setNote(""); return result; }, "Note added")}>Add note</Button>
      </section>
    </div>
  );
}

export function UserRestrictionControls({ userId, suspended }: { userId: string; suspended: boolean }) {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("168h");
  const { pending, run } = useAdminMutation();
  return (
    <section className="rounded-xl border border-border bg-panel p-4">
      <h2 className="font-semibold text-ink">Account access</h2>
      <p className="mt-1 text-sm text-muted-foreground">Actions are reversible, reasoned, and audited.</p>
      <Textarea className="mt-4" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={suspended ? "Reason for restoring access" : "Reason for suspension"} />
      {!suspended ? <select value={duration} onChange={(event) => setDuration(event.target.value)} className="mt-3 h-10 w-full rounded-lg bg-background px-3 text-sm shadow-[var(--neu-inset-sm)]"><option value="24h">24 hours</option><option value="168h">7 days</option><option value="720h">30 days</option><option value="876000h">Indefinite</option></select> : null}
      <Button className="mt-3" variant={suspended ? "outline" : "destructive"} disabled={pending || reason.trim().length < 10} onClick={() => run(() => suspended ? restoreAccount({ userId, reason }) : suspendAccount({ userId, duration, reason }), suspended ? "Account restored" : "Account suspended")}>{suspended ? "Restore account" : "Suspend account"}</Button>
    </section>
  );
}

export function ListingRestrictionControls({ listingId, restricted }: { listingId: string; restricted: boolean }) {
  const [reason, setReason] = useState("");
  const { pending, run } = useAdminMutation();
  return (
    <section className="rounded-xl border border-border bg-panel p-4">
      <h2 className="font-semibold text-ink">Public visibility</h2>
      <p className="mt-1 text-sm text-muted-foreground">Restricted listings remain visible to their landlord but disappear from public discovery.</p>
      <Textarea className="mt-4" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={restricted ? "Reason for restoring this listing" : "Reason for hiding this listing"} />
      <Button className="mt-3" variant={restricted ? "outline" : "destructive"} disabled={pending || reason.trim().length < 10} onClick={() => run(() => restricted ? restoreListing({ listingId, reason }) : restrictListing({ listingId, reason }), restricted ? "Listing restored" : "Listing hidden")}>{restricted ? "Restore listing" : "Hide listing"}</Button>
    </section>
  );
}

export function RetryNotificationButton({ eventId }: { eventId: string }) {
  const { pending, run } = useAdminMutation();
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => retryNotification(eventId), "Notification queued")}>Retry</Button>;
}

export function AdminInviteForm() {
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<"owner" | "admin">("admin");
  const { pending, run } = useAdminMutation();
  return (
    <section className="rounded-xl border border-border bg-panel p-4">
      <h2 className="font-semibold text-ink">Invite or promote</h2>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" />
        <select value={level} onChange={(event) => setLevel(event.target.value as "owner" | "admin")} className="h-11 rounded-lg bg-background px-3 text-sm shadow-[var(--neu-inset-sm)] sm:h-8"><option value="admin">Admin</option><option value="owner">Owner</option></select>
        <Button disabled={pending || !email} onClick={() => run(() => inviteOrPromoteAdmin({ email, level }), "Membership saved")}>Continue</Button>
      </div>
    </section>
  );
}

export function RevokeMemberButton({ userId }: { userId: string }) {
  const [reason, setReason] = useState("");
  const { pending, run } = useAdminMutation();
  return <div className="flex min-w-72 gap-2"><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Revocation reason" /><Button variant="destructive" size="sm" disabled={pending || reason.length < 10} onClick={() => run(() => revokeAdminMembership({ userId, reason }), "Membership revoked")}>Revoke</Button></div>;
}

export function ResetMfaButton({ userId, factorId }: { userId: string; factorId: string }) {
  const [reason, setReason] = useState("");
  const { pending, run } = useAdminMutation();
  return <div className="mt-2 flex min-w-72 gap-2"><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="MFA reset reason" /><Button variant="outline" size="sm" disabled={pending || reason.length < 10} onClick={() => run(() => resetAdminMfa(userId, factorId, reason), "MFA factor reset")}>Reset MFA</Button></div>;
}

export function SensitiveGrantForm({ caseId }: { caseId: string }) {
  const [resourceType, setResourceType] = useState<"conversation" | "document">("conversation");
  const [resourceId, setResourceId] = useState("");
  const [reason, setReason] = useState("");
  const { pending, run } = useAdminMutation();
  return (
    <section className="rounded-xl border border-border bg-panel p-4">
      <h2 className="font-semibold text-ink">Sensitive reveal</h2>
      <p className="mt-1 text-sm text-muted-foreground">Creates a 15-minute, case-bound grant. Every reveal is audited.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[150px_1fr]">
        <select value={resourceType} onChange={(event) => setResourceType(event.target.value as "conversation" | "document")} className="h-11 rounded-lg bg-background px-3 text-sm shadow-[var(--neu-inset-sm)] sm:h-8"><option value="conversation">Conversation</option><option value="document">Document</option></select>
        <Input value={resourceId} onChange={(event) => setResourceId(event.target.value)} placeholder="Resource UUID" />
      </div>
      <Textarea className="mt-2" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this private information is required for the active case" />
      <Button className="mt-3" variant="outline" disabled={pending || reason.length < 20 || !resourceId} onClick={() => run(() => createSensitiveAccessGrant({ caseId, resourceType, resourceId, reason }), "Sensitive access granted for 15 minutes")}>Grant access</Button>
    </section>
  );
}
