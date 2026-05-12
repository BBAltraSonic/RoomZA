import type { Metadata } from "next";
import { FileText, MapPin, CheckCircle, Clock, XCircle, AlertCircle, MessageCircle, CalendarClock } from "lucide-react";
import Link from "next/link";
import { getMyApplications } from "@/features/applications/actions";
import { WithdrawButton } from "@/features/applications/withdraw-button";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SelectViewingSlot } from "@/features/viewings/components/select-viewing-slot";

export const metadata: Metadata = {
  title: "My Applications",
  robots: { index: false, follow: false },
};

const statusConfig = {
  submitted: { icon: Clock, color: "text-blue-500", bg: "bg-blue-50", label: "Submitted" },
  under_review: { icon: AlertCircle, color: "text-yellow-600", bg: "bg-yellow-50", label: "Under Review" },
  shortlisted: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Shortlisted" },
  approved: { icon: CheckCircle, color: "text-[#173b33]", bg: "bg-[#e7f2ee]", label: "Approved" },
  rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-50", label: "Rejected" },
  withdrawn: { icon: XCircle, color: "text-gray-500", bg: "bg-gray-50", label: "Withdrawn" },
};

export default async function ApplicationsPage() {
  const { profile } = await requireRole("renter");
  const applications = await getMyApplications();

  const activeCount = applications.filter((app) =>
    ["submitted", "under_review", "shortlisted", "approved"].includes(app.status)
  ).length;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-[#2d5b52]">Renter workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">My Applications</h1>
            <p className="mt-2 text-sm text-muted-foreground">{profile.email}</p>
          </div>
          <div className="text-right">
            <div className="inline-flex rounded-xl bg-[#e7f2ee] p-3 border border-[#2b6357]/20">
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold uppercase text-[#173b33] tracking-widest">Active Applications</span>
                <span className="text-2xl font-bold text-[#173b33]">{activeCount} / 5</span>
              </div>
            </div>
            {activeCount >= 5 && (
              <p className="text-xs text-red-600 font-medium mt-2 max-w-xs ml-auto">
                You&apos;ve reached your maximum limit of 5 applications. Withdraw an application to free up space.
              </p>
            )}
          </div>
        </div>

        <section className="mt-8 space-y-4">
          {applications.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 shadow-sm text-center">
              <FileText className="mx-auto mb-4 size-10 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">No applications yet</h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Explore the discovery map and apply for your new home. Your applications will show up here.
              </p>
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#173b33] px-6 font-medium text-white transition-colors hover:bg-[#102a24]"
              >
                Find a home
              </Link>
            </div>
          ) : (
            applications.map((app) => {
              const status = statusConfig[app.status as keyof typeof statusConfig] || statusConfig.submitted;
              const StatusIcon = status.icon;
              // Types return an array or single based on schema, handle listing relation properly:
              const listing = Array.isArray(app.listing) ? app.listing[0] : app.listing;
              if (!listing) return null;

              const isWithdrawable = ["submitted", "under_review", "shortlisted"].includes(app.status);
              const conversations = Array.isArray(app.conversations) ? app.conversations : [];
              const conversation = conversations[0];
              const viewings = Array.isArray(app.viewings) ? app.viewings : [];
              const bookedViewing = viewings.find((viewing) => viewing.status === "booked");
              const offers = Array.isArray(app.viewing_slot_offers) ? app.viewing_slot_offers : [];
              const availableSlots = offers
                .map((offer) => (Array.isArray(offer.slot) ? offer.slot[0] : offer.slot))
                .filter((slot): slot is { id: string; start_time: string; end_time: string; is_booked: boolean } => Boolean(slot && !slot.is_booked));

              return (
                <div key={app.id} className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-1 items-start gap-4">
                      <div className={`mt-1 flex size-10 shrink-0 items-center justify-center rounded-full ${status.bg} ${status.color}`}>
                        <StatusIcon className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold tracking-tight">
                          <Link href={`/listing/${app.listing_id}`} className="hover:underline">
                            {listing.title}
                          </Link>
                        </h3>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                          <MapPin className="size-3.5" />
                          {listing.address}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.bg} ${status.color}`}>
                            {status.label}
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">
                            Applied: {new Date(app.created_at).toLocaleDateString("en-ZA", { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-700">
                            R {new Intl.NumberFormat("en-ZA").format(listing.price)}/mo
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 border-t border-gray-100 pt-4 md:border-0 md:pt-0">
                      {conversation ? (
                        <Button render={<Link href={`/messages/${conversation.id}`} />} variant="outline">
                          <MessageCircle className="size-4" />
                          Message
                        </Button>
                      ) : null}
                      {isWithdrawable && <WithdrawButton applicationId={app.id} />}
                    </div>
                  </div>

                  {bookedViewing?.slot ? (
                    <div className="mt-5 flex items-center gap-3 rounded-lg border border-[#2b6357]/20 bg-[#e7f2ee] p-4 text-sm text-[#173b33]">
                      <CalendarClock className="size-5" />
                      <div>
                        <p className="font-semibold">Viewing booked</p>
                        <p>
                          {new Date(bookedViewing.slot.start_time).toLocaleString("en-ZA", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="mt-5">
                      <SelectViewingSlot applicationId={app.id} slots={availableSlots} />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
