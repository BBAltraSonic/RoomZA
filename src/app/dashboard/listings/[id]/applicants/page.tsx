import { requireRole } from "@/lib/auth";
import { getListingApplicants } from "@/features/applications/actions";
import { getMyListing } from "@/features/listings/actions";
import { ApplicantCard } from "@/features/applications/applicant-card";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function ListingApplicantsPage({ params }: { params: Promise<{ id: string }> }) {
    await requireRole("landlord");
    const { id } = await params;

    // Verify ownership and get listing details
    const listing = await getMyListing(id);
    if (!listing) {
        notFound();
    }

    const applicants = await getListingApplicants(id);

    // Custom grouping logic for aesthetic display
    const activeApplicants = applicants.filter(a => a.status === "shortlisted" || a.status === "submitted" || a.status === "under_review");
    const approvedApplicants = applicants.filter(a => a.status === "approved");
    const inactiveApplicants = applicants.filter(a => a.status === "rejected" || a.status === "withdrawn");

    return (
        <main className="min-h-screen bg-[#fafaf9] pb-16 pt-8">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                {/* Top Navigation */}
                <div className="mb-10">
                    <Button
                        render={<Link href="/dashboard" />}
                        variant="ghost"
                        className="mb-6 -ml-3 rounded-full text-muted-foreground hover:bg-black/5 hover:text-foreground"
                    >
                        <ArrowLeft className="mr-2 size-4" />
                        Back to Dashboard
                    </Button>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-[12px] font-semibold uppercase tracking-widest text-[#b86f42]">Applicant Queue</p>
                            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">{listing.title}</h1>
                            <p className="mt-1 text-sm text-muted-foreground">{listing.address}</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-white px-4 py-2 text-sm font-medium shadow-sm">
                            <Users className="size-4 text-[#173b33]" />
                            {applicants.length} Total Applications
                        </div>
                    </div>
                </div>

                {/* Applicant Queues */}
                {applicants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/60 bg-white/50 py-32 text-center shadow-sm">
                        <div className="rounded-full bg-white p-5 shadow-sm ring-1 ring-black/5">
                            <Users className="size-10 text-muted-foreground/30" />
                        </div>
                        <h3 className="mt-6 text-xl font-medium tracking-tight">No applicants yet</h3>
                        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                            When renters apply to this property, their applications and verified documents will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Approved Cohort */}
                        {approvedApplicants.length > 0 && (
                            <div>
                                <h2 className="mb-4 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-widest text-[#173b33]">
                                    <span className="flex size-6 items-center justify-center rounded-full bg-[#173b33] text-white">{approvedApplicants.length}</span>
                                    Approved
                                </h2>
                                <div className="grid gap-6 sm:grid-cols-2">
                                    {approvedApplicants.map((app) => (
                                        <ApplicantCard key={app.id} application={app} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Active Cohort */}
                        {activeApplicants.length > 0 && (
                            <div>
                                <h2 className="mb-4 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-widest">
                                    <span className="flex size-6 items-center justify-center rounded-full bg-zinc-200 text-zinc-600">{activeApplicants.length}</span>
                                    In Review
                                </h2>
                                <div className="grid gap-6 sm:grid-cols-2">
                                    {activeApplicants.map((app) => (
                                        <ApplicantCard key={app.id} application={app} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Inactive Cohort */}
                        {inactiveApplicants.length > 0 && (
                            <div>
                                <h2 className="mb-4 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
                                    Declined / Withdrawn
                                </h2>
                                <div className="grid gap-6 sm:grid-cols-2 opacity-80">
                                    {inactiveApplicants.map((app) => (
                                        <ApplicantCard key={app.id} application={app} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}
