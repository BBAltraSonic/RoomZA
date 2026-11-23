"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { MotionFeedback, PendingGlyph } from "@/lib/motion/primitives";
import { cn } from "@/lib/utils";

import { minutesToTime, validateViewingHours, VIEWING_SLOT_MINUTES, type ViewingHour } from "./viewing-availability";
import { getMyViewingHours, saveViewingHours } from "./viewing-hours-actions";

/** Monday first for display; values are `getDay()` numbers (0 = Sunday). */
const WEEK: { weekday: number; name: string; short: string }[] = [
  { weekday: 1, name: "Monday", short: "Mon" }, { weekday: 2, name: "Tuesday", short: "Tue" },
  { weekday: 3, name: "Wednesday", short: "Wed" }, { weekday: 4, name: "Thursday", short: "Thu" },
  { weekday: 5, name: "Friday", short: "Fri" }, { weekday: 6, name: "Saturday", short: "Sat" },
  { weekday: 0, name: "Sunday", short: "Sun" },
];

/** 06:00 to 22:00 covers realistic viewing times without a 49-row menu. */
const TIME_OPTIONS = Array.from({ length: (22 - 6) * 2 + 1 }, (_, index) => 6 * 60 + index * VIEWING_SLOT_MINUTES);

const defaultWindow = (weekday: number): ViewingHour => weekday === 0 || weekday === 6
  ? { weekday, startMinute: 600, endMinute: 720 }
  : { weekday, startMinute: 1020, endMinute: 1140 };

type LoadState = { state: "loading" } | { state: "error"; message: string } | { state: "ready" };

/**
 * Weekly viewing hours for every listing the landlord owns. Renters see these
 * as bookable 30-minute slots in the Contact sheet; the "within 15 minutes"
 * promise also respects them.
 */
export function ViewingHoursEditor({ className }: { className?: string }) {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [hours, setHours] = useState<Map<number, ViewingHour>>(new Map());
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    getMyViewingHours().then(result => {
      if (!current) return;
      if (!result.success) return setLoad({ state: "error", message: result.error });
      setHours(new Map(result.data.hours.map(hour => [hour.weekday, hour])));
      setLoad({ state: "ready" });
    }, () => current && setLoad({ state: "error", message: "Viewing hours could not be loaded. Try again." }));
    return () => { current = false; };
  }, [attempt]);
  const read = () => { setLoad({ state: "loading" }); setAttempt(value => value + 1); };

  function update(weekday: number, change: ((current: ViewingHour) => ViewingHour) | null) {
    setFeedback(null);
    setHours(previous => {
      const next = new Map(previous);
      if (change) next.set(weekday, change(previous.get(weekday) ?? defaultWindow(weekday)));
      else next.delete(weekday);
      return next;
    });
  }

  async function save() {
    const valid = validateViewingHours([...hours.values()]);
    if (!valid.ok) return setFeedback({ ok: false, message: valid.error });
    setSaving(true);
    setFeedback(null);
    try {
      const result = await saveViewingHours(valid.hours);
      setFeedback(result.success ? { ok: true, message: "Viewing hours saved." } : { ok: false, message: result.error });
    } catch {
      setFeedback({ ok: false, message: "Viewing hours could not be confirmed. Try again." });
    } finally {
      setSaving(false);
    }
  }

  if (load.state === "loading") return <PendingGlyph label="Loading viewing hours" />;
  if (load.state === "error") return <div role="alert" className={cn("space-y-2 text-sm text-destructive", className)}>
    <p>{load.message}</p>
    <Button size="sm" variant="outline" onClick={read}>Try again</Button>
  </div>;

  const select = "h-9 min-w-0 rounded-md border border-border bg-panel px-2 text-sm font-medium tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return <div className={cn("space-y-3", className)}>
    <fieldset aria-label="Viewing hours" disabled={saving} className="space-y-2">
      <legend className="text-sm font-medium text-ink">Viewing hours</legend>
      <p className="text-xs text-muted-foreground">Renters book 30-minute viewings inside these hours, up to two weeks ahead. Times are South African time.</p>
      <div className="divide-y divide-border rounded-md border border-border bg-warm-surface">
        {WEEK.map(({ weekday, name, short }) => {
          const hour = hours.get(weekday);
          const options = (value: number) => TIME_OPTIONS.includes(value) ? TIME_OPTIONS : [...TIME_OPTIONS, value].sort((a, b) => a - b);
          return <div key={weekday} className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
            <label className="flex w-20 items-center gap-2 text-sm font-semibold text-ink">
              <input type="checkbox" aria-label={name} checked={Boolean(hour)} className="size-4 accent-forest"
                onChange={event => update(weekday, event.target.checked ? current => current : null)} />
              {short}
            </label>
            {hour ? <div className="flex items-center gap-2">
              <select aria-label={`${name} start`} className={select} value={String(hour.startMinute)}
                onChange={event => update(weekday, current => ({ ...current, startMinute: Number(event.target.value) }))}>
                {options(hour.startMinute).map(minute => <option key={minute} value={minute}>{minutesToTime(minute)}</option>)}
              </select>
              <span aria-hidden="true" className="text-xs text-muted-foreground">to</span>
              <select aria-label={`${name} end`} className={select} value={String(hour.endMinute)}
                onChange={event => update(weekday, current => ({ ...current, endMinute: Number(event.target.value) }))}>
                {options(hour.endMinute).map(minute => <option key={minute} value={minute}>{minutesToTime(minute)}</option>)}
              </select>
            </div> : <span className="text-xs text-muted-foreground">No viewings</span>}
          </div>;
        })}
      </div>
    </fieldset>
    <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
      {saving ? <PendingGlyph label="Saving viewing hours" /> : null}Save viewing hours
    </Button>
    {feedback ? <MotionFeedback state={feedback.ok ? "success" : "error"} className={cn("rounded-md border p-2 text-xs",
      feedback.ok ? "border-forest/20 bg-accent text-forest" : "border-destructive/20 bg-destructive/10 text-destructive")}>
      {feedback.message}
    </MotionFeedback> : null}
  </div>;
}
