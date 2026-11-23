"use client";

import { useState } from "react";
import { CalendarCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PendingGlyph } from "@/lib/motion/primitives";
import { cn } from "@/lib/utils";

import { calendarDays, formatSlotRequest, formatSlotTime, type ViewingSlot } from "./viewing-availability";

type ViewingCalendarProps = {
  slots: ViewingSlot[];
  disabled: boolean;
  pending: boolean;
  onRequest: (slotStart: string) => void;
};

/**
 * The landlord's open viewing times as a day strip plus the chosen day's times.
 * Days without open times stay visible but disabled so gaps read as "booked or
 * outside their hours" rather than as missing data.
 */
export function ViewingCalendar({ slots, disabled, pending, onRequest }: ViewingCalendarProps) {
  const days = calendarDays(slots);
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [chosenSlot, setChosenSlot] = useState<string | null>(null);
  // Fall back to the first open day if the chosen one was booked out by a refresh.
  const day = days.find(entry => entry.key === chosenDay && entry.slots.length > 0) ?? days.find(entry => entry.slots.length > 0);
  const slot = day?.slots.find(entry => entry.start === chosenSlot) ?? null;
  if (!day) return null;

  return <div className="grid gap-2">
    <div role="group" aria-label="Viewing calendar" className="grid gap-2">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {days.map(entry => {
          const count = entry.slots.length, selected = entry.key === day.key;
          return <button key={entry.key} type="button" disabled={disabled || count === 0} aria-pressed={selected}
            aria-label={`${entry.weekday} ${entry.day} ${entry.month}, ${count === 0 ? "no open times" : `${count} open time${count === 1 ? "" : "s"}`}`}
            onClick={() => { setChosenDay(entry.key); setChosenSlot(null); }}
            className={cn(
              "flex min-h-16 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "border-selection bg-selection text-selection-foreground" : "border-border bg-panel hover:bg-warm-surface",
              count === 0 && "border-dashed text-muted-foreground opacity-50",
            )}>
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wide">{entry.weekday}</span>
            <span className="text-base font-bold leading-none">{entry.day}</span>
            <span aria-hidden="true" className={cn("mt-1 size-1.5 rounded-full", count === 0 ? "bg-transparent" : selected ? "bg-selection-foreground" : "bg-forest")} />
          </button>;
        })}
      </div>
      <div role="radiogroup" aria-label={`Open times on ${day.weekday} ${day.day} ${day.month}`} className="grid grid-cols-4 gap-1.5">
        {day.slots.map(entry => {
          const checked = entry.start === slot?.start;
          return <button key={entry.start} type="button" role="radio" aria-checked={checked} disabled={disabled}
            onClick={() => setChosenSlot(entry.start)}
            className={cn(
              "min-h-10 rounded-lg border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              checked ? "border-selection bg-selection text-selection-foreground" : "border-border bg-panel text-ink hover:bg-warm-surface",
            )}>{formatSlotTime(entry.start)}</button>;
        })}
      </div>
    </div>
    <Button type="button" className="h-11 w-full" disabled={disabled || !slot} onClick={() => slot && onRequest(slot.start)}>
      {pending ? <PendingGlyph label="Sending viewing request" /> : <CalendarCheck className="size-4" aria-hidden="true" />}
      {slot ? `Request ${formatSlotRequest(slot.start)}` : "Choose a time"}
    </Button>
    <p className="text-xs text-muted-foreground">Times are South African time. The landlord confirms before the viewing.</p>
  </div>;
}
