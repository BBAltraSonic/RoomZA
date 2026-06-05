"use client";

import { useState } from "react";
import { AlertCircle, BookmarkPlus, CalendarClock, Check, ExternalLink, FileText, History, Loader2, MessageCircle, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/premium/primitives";
import { ProposeViewingModal } from "@/features/viewings/components/propose-viewing-modal";
import { getOrCreateApplicationConversation } from "@/features/chat/actions";
import type { Database } from "@/lib/supabase/types";

import { updateApplicationStatus } from "./actions";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

type ApplicantDocument = {
  id: string;
  type: Database["public"]["Enums"]["document_type"];
  file_url: string;
};

type ApplicantApplication = {
  id: string;
  listing_id: string;
  status: ApplicationStatus;
  full_name: string;
  created_at: string;
  income: number;
  move_in_date: string;
  employment_status: string;
  household_size: number;
  documents?: ApplicantDocument[] | null;
  viewings?: {
    id: string;
    status: Database["public"]["Enums"]["viewing_status"];
    meeting_join_url?: string | null;
    meeting_room_id?: string | null;
    slot?: {
      id: string;
      start_time: string;
      end_time: string;
      mode?: Database["public"]["Enums"]["viewing_mode"];
    } | {
      id: string;
      start_time: string;
      end_time: string;
      mode?: Database["public"]["Enums"]["viewing_mode"];
    }[] | null;
  }[] | null;
  application_status_events?: {
    id: string;
    from_status: ApplicationStatus;
    to_status: ApplicationStatus;
    created_at: string;
    actor_id: string;
  }[] | null;
};

function formatCurrency(amount: number) {
  return `R ${new Intl.NumberFormat("en-ZA").format(amount)}`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-ZA", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

function statusTone(status: ApplicationStatus) {
  if (status === "approved") return "success";
  if (status === "shortlisted") return "clay";
  if (status === "rejected") return "error";
  if (status === "withdrawn") return "neutral";
  return "forest";
}

export function ApplicantCard({ application }: { application: ApplicantApplication }) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [status, setStatus] = useState<ApplicationStatus>(application.status);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const docs = application.documents || [];
  const idDocument = docs.find((document) => document.type === "id");
  const payslipDocument = docs.find((document) => document.type === "payslip");
  const hasId = Boolean(idDocument);
  const hasPayslip = Boolean(payslipDocument);
  const bookedViewing = (application.viewings ?? []).find((viewing) => viewing.status === "booked");
  const bookedSlot = Array.isArray(bookedViewing?.slot) ? bookedViewing.slot[0] : bookedViewing?.slot;

  async function handleStatus(newStatus: ApplicationStatus) {
    setIsUpdating(true);
    setError(null);
    const res = await updateApplicationStatus(application.id, newStatus);
    if (res.success) {
      setStatus(newStatus);
    } else {
      setError(res.error ?? "Failed to update status");
    }
    setIsUpdating(false);
  }

  async function handleOpenDocument(document: ApplicantDocument | undefined, label: string) {
    if (!document) return;

    setOpeningDocumentId(document.id);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${document.id}/signed-url`);
      const payload = (await response.json()) as { ok?: boolean; data?: { url?: string }; error?: { message?: string } };

      if (!response.ok || !payload.ok || !payload.data?.url) {
        setError(payload.error?.message ?? `Failed to open ${label}.`);
        return;
      }

      window.open(payload.data.url, "_blank", "noopener,noreferrer");
    } catch {
      setError(`Failed to open ${label}.`);
    } finally {
      setOpeningDocumentId(null);
    }
  }

  return (
    <article className="rounded-lg border border-border bg-panel p-5 shadow-[var(--elevation-1)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold tracking-normal text-ink">{application.full_name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Applied {formatDate(application.created_at)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge tone={statusTone(status)}>{status.replace("_", " ")}</StatusBadge>
          {application.application_status_events && application.application_status_events.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="h-7 text-xs text-muted-foreground hover:text-ink"
            >
              <History className="size-3" />
              History
            </Button>
          ) : null}
        </div>
      </div>

      {showHistory && application.application_status_events ? (
        <div className="mt-4 rounded-md border border-border bg-warm-surface p-3 text-sm">
          <p className="mb-2 font-medium text-ink">Status History</p>
          <ul className="space-y-2 border-l-2 border-border pl-3">
            {application.application_status_events.map((event) => (
              <li key={event.id} className="text-muted-foreground">
                <span className="font-medium text-ink">{event.to_status.replace("_", " ")}</span>
                <span className="mx-2 text-xs">·</span>
                <span className="text-xs">{formatDate(event.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-warm-surface p-3 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Income</p>
          <p className="mt-1 text-sm font-semibold text-ink">{formatCurrency(application.income)}/mo</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Move in</p>
          <p className="mt-1 text-sm font-semibold text-ink">{formatDate(application.move_in_date)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Employment</p>
          <p className="mt-1 text-sm font-semibold capitalize text-ink">{application.employment_status}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Household</p>
          <p className="mt-1 text-sm font-semibold text-ink">{application.household_size}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={hasId ? "outline" : "ghost"}
          size="sm"
          disabled={!idDocument || openingDocumentId === idDocument.id}
          onClick={() => handleOpenDocument(idDocument, "ID")}
          className="h-10 border-border bg-warm-surface text-ink disabled:opacity-70 sm:h-8"
          aria-label={hasId ? "Open ID document" : "ID document missing"}
        >
          {openingDocumentId === idDocument?.id ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
          {hasId ? "Open ID" : "Missing ID"}
          {hasId ? <ExternalLink className="size-3.5" /> : null}
        </Button>
        <Button
          type="button"
          variant={hasPayslip ? "outline" : "ghost"}
          size="sm"
          disabled={!payslipDocument || openingDocumentId === payslipDocument.id}
          onClick={() => handleOpenDocument(payslipDocument, "payslip")}
          className="h-10 border-border bg-warm-surface text-ink disabled:opacity-70 sm:h-8"
          aria-label={hasPayslip ? "Open payslip document" : "Payslip document missing"}
        >
          {openingDocumentId === payslipDocument?.id ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
          {hasPayslip ? "Open payslip" : "Missing payslip"}
          {hasPayslip ? <ExternalLink className="size-3.5" /> : null}
        </Button>
      </div>

      {error ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {error}
        </div>
      ) : null}

      {bookedViewing && bookedSlot ? (
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-forest/20 bg-accent p-4 text-sm text-forest sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {bookedSlot.mode === "video_call" ? <Video className="size-5 shrink-0" /> : <CalendarClock className="size-5 shrink-0" />}
            <div>
              <p className="font-semibold">Viewing booked</p>
              <p>
                {new Date(bookedSlot.start_time).toLocaleString("en-ZA", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </div>
          {bookedSlot.mode === "video_call" ? (
            <Button render={<Link href={`/viewings/${bookedViewing.id}/live`} />} className="h-10 bg-forest text-primary-foreground hover:bg-forest/90 sm:h-9">
              <Video className="size-4" />
              Join
            </Button>
          ) : null}
        </div>
      ) : null}

      {status !== "rejected" && status !== "withdrawn" ? (
        <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            {status !== "approved" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatus("rejected")}
                disabled={isUpdating}
                className="h-10 border-rose-200 text-rose-700 hover:bg-rose-50 sm:h-7"
              >
                <X className="size-3.5" />
                Decline
              </Button>
            ) : null}
            {status !== "shortlisted" && status !== "approved" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatus("shortlisted")}
                disabled={isUpdating}
                className="h-10 border-clay/30 text-clay hover:bg-orange-50 sm:h-7"
              >
                <BookmarkPlus className="size-3.5" />
                Shortlist
              </Button>
            ) : null}
            {status === "shortlisted" ? (
              <Button
                size="sm"
                onClick={() => handleStatus("approved")}
                disabled={isUpdating}
                className="h-10 bg-forest text-primary-foreground hover:bg-forest/90 sm:h-7"
              >
                <Check className="size-3.5" />
                Approve
              </Button>
            ) : null}
          </div>

          <Button
            variant="secondary"
            size="sm"
            disabled={isUpdating}
            className="h-10 bg-forest text-primary-foreground hover:bg-forest/90 sm:h-7"
            onClick={async () => {
              setIsUpdating(true);
              const res = await getOrCreateApplicationConversation(application.id);
              if (res.success && res.conversationId) {
                router.push(`/messages/${res.conversationId}`);
              } else {
                setError("Failed to start conversation.");
              }
              setIsUpdating(false);
            }}
          >
            <MessageCircle className="size-3.5" />
            Message
          </Button>
        </div>
      ) : (
        <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
          This application is closed.
        </p>
      )}

      {status === "shortlisted" ? (
        <div className="mt-4 border-t border-border pt-4">
          <ProposeViewingModal listingId={application.listing_id} applicantIds={[application.id]} />
        </div>
      ) : null}
    </article>
  );
}
