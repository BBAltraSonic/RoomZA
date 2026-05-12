"use client";

import { useState } from "react";
import { Check, X, BookmarkPlus, MessageCircle, FileText, AlertCircle } from "lucide-react";
import { updateApplicationStatus } from "./actions";
import { getOrCreateApplicationConversation } from "@/features/chat/actions";
import { ProposeViewingModal } from "@/features/viewings/components/propose-viewing-modal";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/supabase/types";

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

export function ApplicantCard({ application }: { application: ApplicantApplication }) {
    const router = useRouter();
    const [isUpdating, setIsUpdating] = useState(false);
    const [status, setStatus] = useState<ApplicationStatus>(application.status);
    const [error, setError] = useState<string | null>(null);

    const docs = application.documents || [];
    const hasId = docs.some((d) => d.type === "id");
    const hasPayslip = docs.some((d) => d.type === "payslip");

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

    // Determine top styling based on status
    let cardRing = "border-border/40 hover:border-[#173b33]/20";
    let statusBadge = null;

    if (status === "shortlisted") {
        cardRing = "border-[#b86f42]/40 ring-1 ring-[#b86f42] bg-[#fcf9f7]";
        statusBadge = (
            <div className="absolute right-4 top-4 rounded-full bg-[#b86f42]/10 px-2.5 py-1 text-xs font-semibold tracking-wider text-[#b86f42]">
                SHORTLISTED
            </div>
        );
    } else if (status === "approved") {
        cardRing = "border-green-500/40 ring-1 ring-green-500 bg-green-50/30";
        statusBadge = (
            <div className="absolute right-4 top-4 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold tracking-wider text-green-700">
                APPROVED
            </div>
        );
    } else if (status === "rejected") {
        cardRing = "border-rose-500/20 bg-rose-50/20 opacity-80 line-through grayscale-[0.2]";
    }

    return (
        <div className={`relative overflow-hidden rounded-3xl border bg-white p-6 shadow-sm transition-all duration-300 ${cardRing}`}>
            {statusBadge}

            <div className="mb-4">
                <h3 className="text-xl font-bold tracking-tight text-foreground">{application.full_name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Applied {formatDate(application.created_at)}
                </p>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4 rounded-2xl bg-muted/30 p-4 sm:grid-cols-4">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Income</p>
                    <p className="mt-1 font-medium">{formatCurrency(application.income)}<span className="text-xs text-muted-foreground">/mo</span></p>
                </div>
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Move-in Date</p>
                    <p className="mt-1 font-medium">{formatDate(application.move_in_date)}</p>
                </div>
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Employment</p>
                    <p className="mt-1 capitalize font-medium">{application.employment_status}</p>
                </div>
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Household Size</p>
                    <p className="mt-1 font-medium">{application.household_size} {application.household_size === 1 ? "Person" : "People"}</p>
                </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-3">
                <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${hasId ? "border-green-200 bg-green-50 text-green-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                    <FileText className="size-3.5" />
                    {hasId ? "ID Verified" : "Missing ID"}
                </div>
                <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${hasPayslip ? "border-green-200 bg-green-50 text-green-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                    <FileText className="size-3.5" />
                    {hasPayslip ? "Payslip Verified" : "Missing Payslip"}
                </div>
            </div>

            {error && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="size-4" />
                    {error}
                </div>
            )}

            {status !== "rejected" && status !== "withdrawn" && (
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-5">
                    <div className="flex gap-2">
                        {status !== "approved" && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatus("rejected")}
                                disabled={isUpdating}
                                className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                            >
                                <X className="mr-1.5 size-3.5" />
                                Decline
                            </Button>
                        )}
                        {status !== "shortlisted" && status !== "approved" && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatus("shortlisted")}
                                disabled={isUpdating}
                                className="rounded-full border-[#b86f42]/30 text-[#b86f42] hover:bg-[#b86f42]/10 hover:text-[#a05f37]"
                            >
                                <BookmarkPlus className="mr-1.5 size-3.5" />
                                Shortlist
                            </Button>
                        )}
                        {status === "shortlisted" && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleStatus("approved")}
                                disabled={isUpdating}
                                className="rounded-full bg-green-600 text-white shadow-sm hover:bg-green-700"
                            >
                                <Check className="mr-1.5 size-3.5" />
                                Approve Application
                            </Button>
                        )}
                    </div>

                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={isUpdating}
                        className="rounded-full bg-[#173b33] text-white hover:bg-[#102a24]"
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
                        <MessageCircle className="mr-1.5 size-3.5" />
                        Message Renter
                    </Button>
                </div>
            )}

            {status === "shortlisted" && (
                <div className="mt-4 border-t border-border/40 pt-4">
                    <ProposeViewingModal listingId={application.listing_id} applicantIds={[application.id]} />
                </div>
            )}

            {status === "withdrawn" && (
                <div className="border-t border-border/40 pt-4 text-sm text-muted-foreground font-medium italic">
                    The renter has withdrawn this application.
                </div>
            )}
        </div>
    );
}
