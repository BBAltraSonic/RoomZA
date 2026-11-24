import type { ReminderRequest } from "./request-intent";

/**
 * When a reminder is due, in South African time (UTC+2 all year, no daylight saving).
 * "Today" means 17:00 today, or an hour from now once that has passed; every other choice
 * means 09:00 on that day. Snooze offers the proposal's two choices: tomorrow and next week.
 */

const SAST_OFFSET_MS = 2 * 60 * 60_000;
const DAY_MS = 86_400_000;

export type ReminderDue = NonNullable<ReminderRequest["due"]>;
export type SnoozeChoice = "tomorrow" | "next-week";

/** Midnight in South Africa at the start of `now`'s local day, as a UTC timestamp. */
function sastMidnight(now: Date) {
  const local = now.getTime() + SAST_OFFSET_MS;
  return local - (((local % DAY_MS) + DAY_MS) % DAY_MS) - SAST_OFFSET_MS;
}

function sastWeekday(now: Date) {
  return new Date(now.getTime() + SAST_OFFSET_MS).getUTCDay();
}

function at(midnight: number, daysAhead: number, hour: number) {
  return new Date(midnight + daysAhead * DAY_MS + hour * 60 * 60_000);
}

export function reminderDueAt(due: ReminderDue, now: Date): Date {
  const midnight = sastMidnight(now);
  const weekday = sastWeekday(now);
  switch (due) {
    case "today": {
      const evening = at(midnight, 0, 17);
      return evening.getTime() > now.getTime() ? evening : new Date(now.getTime() + 60 * 60_000);
    }
    case "tomorrow":
      return at(midnight, 1, 9);
    case "next-week":
      // The coming Monday; from Sunday that is tomorrow, from Monday a week away.
      return at(midnight, ((1 - weekday + 7) % 7) || 7, 9);
    case "friday":
      return at(midnight, ((5 - weekday + 7) % 7) || 7, 9);
  }
}

export function snoozedUntil(choice: SnoozeChoice, now: Date): Date {
  return reminderDueAt(choice, now);
}

export function isDueBy(dueAt: string, now: Date): boolean {
  const due = Date.parse(dueAt);
  return Number.isFinite(due) && due < sastMidnight(now) + DAY_MS;
}
