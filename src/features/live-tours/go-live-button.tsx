"use client";

import {
  CalendarClock,
  CalendarPlus,
  Radio,
  Video,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PendingGlyph } from "@/lib/motion/primitives";

import {
  cancelScheduledLiveTour,
  scheduleLiveTour,
  startLiveTour,
  startScheduledLiveTour,
} from "./actions";
import { formatLiveTourSchedule } from "./schedule";
import type { LiveTour } from "./types";

function toLocalInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function initialScheduleValue() {
  const date = new Date(Date.now() + 24 * 60 * 60_000);
  date.setHours(18, 0, 0, 0);
  return toLocalInputValue(date);
}

export function LiveTourControls({
  listingId,
  upcomingTour,
  scheduledEnabled,
}: {
  listingId: string;
  upcomingTour?: LiveTour | null;
  scheduledEnabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(initialScheduleValue);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [pending, startTransition] = useTransition();
  const [minSchedule] = useState(
    () => toLocalInputValue(new Date(Date.now() + 15 * 60_000)),
  );

  function run(
    work: () => Promise<
      | { success: true; data: { tour: LiveTour } }
      | { success: true; data: { status: "cancelled" } }
      | { success: false; error: string }
    >,
    successMessage: string,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.success) {
        setError(result.error);
        return;
      }

      toast.success(successMessage);
      if ("tour" in result.data) {
        router.push(`/live-tours/${result.data.tour.id}`);
      } else {
        setScheduleOpen(false);
        router.refresh();
      }
    });
  }

  if (upcomingTour?.scheduled_at) {
    return (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-status-info-border bg-status-info-surface p-2.5">
          <span className="inline-flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-status-info-text">
            <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Open house {formatLiveTourSchedule(upcomingTour.scheduled_at)}
            </span>
          </span>
          <Button
            type="button"
            size="sm"
            className="min-h-11 sm:min-h-10"
            disabled={pending}
            onClick={() =>
              run(
                () => startScheduledLiveTour(upcomingTour.id),
                "Open house is live",
              )
            }
          >
            {pending
              ? <PendingGlyph label="Starting open house" />
              : <Radio className="size-4" aria-hidden="true" />}
            Start
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="size-11 sm:size-10"
            aria-label="Cancel scheduled open house"
            disabled={pending}
            onClick={() =>
              run(
                () => cancelScheduledLiveTour(upcomingTour.id),
                "Open house cancelled",
              )
            }
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        {error ? (
          <p className="mt-1 max-w-80 text-xs font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 border-status-error-border bg-status-error-surface text-status-error-text hover:bg-status-error-surface/80 sm:h-10"
          disabled={pending}
          onClick={() =>
            run(() => startLiveTour(listingId), "Your live tour is ready")
          }
        >
          {pending
            ? <PendingGlyph label="Starting live tour" />
            : <Radio className="size-4" aria-hidden="true" />}
          Go live
          <Video className="size-4" aria-hidden="true" />
        </Button>
        {scheduledEnabled ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:h-10"
            aria-expanded={scheduleOpen}
            onClick={() => setScheduleOpen((value) => !value)}
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            Schedule
          </Button>
        ) : null}
      </div>

      {scheduleOpen ? (
        <form
          className="mt-2 grid gap-3 rounded-xl border border-border bg-muted/35 p-3 sm:grid-cols-[minmax(12rem,1fr)_8rem_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const date = new Date(scheduledAt);
            if (!Number.isFinite(date.getTime())) {
              setError("Choose a valid open-house time.");
              return;
            }
            run(
              () =>
                scheduleLiveTour({
                  listingId,
                  scheduledAt: date.toISOString(),
                  durationMinutes,
                }),
              "Open house scheduled",
            );
          }}
        >
          <label className="text-xs font-semibold text-muted-foreground">
            Date and time
            <Input
              type="datetime-local"
              className="mt-1 h-11 bg-background text-sm sm:h-10"
              min={minSchedule}
              value={scheduledAt}
              disabled={pending}
              onChange={(event) => setScheduledAt(event.target.value)}
              required
            />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Duration
            <select
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground sm:h-10"
              value={durationMinutes}
              disabled={pending}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
            </select>
          </label>
          <Button
            type="submit"
            className="min-h-11 self-end sm:min-h-10"
            disabled={pending}
          >
            {pending
              ? <PendingGlyph label="Scheduling open house" />
              : <CalendarPlus className="size-4" aria-hidden="true" />}
            Schedule
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="mt-1 max-w-80 text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function GoLiveButton({ listingId }: { listingId: string }) {
  return (
    <LiveTourControls
      listingId={listingId}
      scheduledEnabled={false}
    />
  );
}
