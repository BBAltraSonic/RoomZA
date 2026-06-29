import type { Metadata } from "next";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle,
  Clock,
  FileText,
  Home,
  MapPin,
  MessageCircle,
  Video,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import { AppShell, EmptyState, MetricStrip, PageHeader, StatusBadge } from "@/components/premium/primitives";
import { Button } from "@/components/ui/button";
import { getMyApplications } from "@/features/applications/actions";
import { WithdrawButton } from "@/features/applications/withdraw-button";
import { SelectViewingSlot } from "@/features/viewings/components/select-viewing-slot";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "My Applications",
  robots: { index: false, follow: false },
};

const statusConfig = {
  submitted: { icon: Clock, tone: "info", label: "Submitted" },
  under_review: { icon: AlertCircle, tone: "warning", label: "Under review" },
  shortlisted: { icon: CheckCircle, tone: "clay", label: "Shortlisted" },
  approved: { icon: CheckCircle, tone: "success", label: "Approved" },
  rejected: { icon: XCircle, tone: "error", label: "Rejected" },
  withdrawn: { icon: XCircle, tone: "neutral", label: "Withdrawn" },
} as const;

export default async function ApplicationsPage() {
  const { profile } = await requireRole("renter", { redirectTo: "/applications" });
  const applicationsResult = await getMyApplications();
  const applications = applicationsResult.success ? applicationsResult.data ?? [] : [];

  const activeCount = applications.filter((app) =>
    ["submitted", "under_review", "shortlisted", "approved"].includes(app.status),
  ).length;

  return (
    <AppShell width="md" className="pt-2 md:pt-20">
      <PageHeader
        eyebrow="Renter workspace"
        title="Applications"
        description={profile.email}
        action={
          <MetricStrip
            className="min-w-[260px] sm:grid-cols-1"
            metrics={[{ label: "Active applications", value: `${activeCount} / 5`, tone: activeCount >= 5 ? "clay" : "forest" }]}
          />
        }
      />

      {activeCount >= 5 ? (
        <div className="mb-5 rounded-lg border border-status-warning-border bg-status-warning-surface p-4 text-sm text-status-warning-text">
          You have reached the limit of 5 active applications. Withdraw one before applying elsewhere.
        </div>
      ) : null}

      {!applicationsResult.success ? (
        <div className="mb-5 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {applicationsResult.error}
        </div>
      ) : null}

      {applications.length === 0 && applicationsResult.success ? (
        <EmptyState
          icon={FileText}
          title="No applications yet"
          description="Apply from a listing when you are ready. Your status, messages, and viewing offers will appear here."
          action={
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-md bg-forest px-4 text-sm font-medium text-primary-foreground hover:bg-forest/90"
            >
              Find a home
            </Link>
          }
        />
      ) : (
        <section className="space-y-4">
          {applications.map((app) => {
            const status = statusConfig[app.status as keyof typeof statusConfig] || statusConfig.submitted;
            const StatusIcon = status.icon;
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
              .filter((slot): slot is { id: string; start_time: string; end_time: string; is_booked?: boolean; mode?: "in_person" | "video_call" } => Boolean(slot && !slot.is_booked));
            const bookedSlot = Array.isArray(bookedViewing?.slot) ? bookedViewing.slot[0] : bookedViewing?.slot;
            const isVideoViewing = bookedSlot?.mode === "video_call";

            return (
              <article key={app.id} className="rounded-2xl border border-border bg-panel p-5 shadow-[var(--elevation-1)] sm:rounded-lg">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3.5 sm:gap-4">
                    <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-warm-surface text-forest sm:size-10 sm:rounded-md">
                      <StatusIcon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold tracking-tight text-ink">
                        <Link href={`/listing/${app.listing_id}`} className="hover:underline">
                          {listing.title}
                        </Link>
                      </h2>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0 text-clay" />
                        <span className="truncate">{listing.address}</span>
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-3">
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                        <span className="text-[0.7rem] font-bold text-muted-foreground/60">
                          {new Date(app.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                        </span>
                        <span className="h-0.5 w-0.5 rounded-full bg-border" />
                        <span className="text-[0.7rem] font-bold text-forest">
                          R {new Intl.NumberFormat("en-ZA").format(listing.price)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 border-t border-border pt-4 sm:flex sm:flex-wrap sm:border-0 sm:pt-0">
                    {conversation ? (
                      <Button render={<Link href={`/messages/${conversation.id}`} />} variant="outline" className="h-11 active:scale-95 sm:h-9 sm:active:scale-100">
                        <MessageCircle className="size-4" />
                        Chat
                      </Button>
                    ) : null}
                    <div className="h-11 sm:h-9">
                      {isWithdrawable ? <WithdrawButton applicationId={app.id} /> : null}
                    </div>
                  </div>
                </div>

                {bookedViewing?.slot ? (
                  <div className="mt-5 flex flex-col gap-3 rounded-lg border border-forest/20 bg-accent p-4 text-sm text-forest sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      {isVideoViewing ? <Video className="size-5 shrink-0" /> : <CalendarClock className="size-5 shrink-0" />}
                      <div>
                      <p className="font-semibold">Viewing booked</p>
                      <p>
                        {new Date(bookedSlot?.start_time ?? "").toLocaleString("en-ZA", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold">
                        {isVideoViewing ? <Video className="size-3.5" /> : <Home className="size-3.5" />}
                        {isVideoViewing ? "Video call" : "In-person"}
                      </p>
                      </div>
                    </div>
                    {isVideoViewing ? (
                      <Button render={<Link href={`/viewings/${bookedViewing.id}/live`} />} className="h-10 bg-forest text-primary-foreground hover:bg-forest/90">
                        <Video className="size-4" />
                        Join
                      </Button>
                    ) : null}
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className="mt-5">
                    <SelectViewingSlot applicationId={app.id} slots={availableSlots} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </AppShell>
  );
}
