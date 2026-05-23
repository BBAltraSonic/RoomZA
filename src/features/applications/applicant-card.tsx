"use client";

import { useState } from "react";
import { AlertCircle, BookmarkPlus, Check, FileText, MessageCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/premium/primitives";
import { ProposeViewingModal } from "@/features/viewings/components/propose-viewing-modal";
import { getOrCreateApplicationConversation } from "@/features/chat/actions";
import type { Database } from "@/lib/supabase/types";

import { updateApplicationStatus } from "./actions";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

type ApplicantDocument = {
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
  const [status, setStatus] = useState<ApplicationStatus>(application.status);
  const [error, setError] = useState<string | null>(null);

  const docs = application.documents || [];
  const hasId = docs.some((document) => document.type === "id");
  const hasPayslip = docs.some((document) => document.type === "payslip");

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

  return (
    <article className="rounded-lg border border-border bg-panel p-5 shadow-[var(--elevation-1)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold tracking-normal text-ink">{application.full_name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Applied {formatDate(application.created_at)}</p>
        </div>
        <StatusBadge tone={statusTone(status)}>{status.replace("_", " ")}</StatusBadge>
      </div>

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
        <StatusBadge tone={hasId ? "success" : "error"}>
          <FileText className="size-3.5" />
          {hasId ? "ID ready" : "Missing ID"}
        </StatusBadge>
        <StatusBadge tone={hasPayslip ? "success" : "error"}>
          <FileText className="size-3.5" />
          {hasPayslip ? "Payslip ready" : "Missing payslip"}
        </StatusBadge>
      </div>

      {error ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {error}
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
