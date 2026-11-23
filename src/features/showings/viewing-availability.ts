/**
 * Pure helpers for landlord viewing availability: the "can they meet within
 * 15 minutes" summary and the bookable-slot calendar. No I/O. All calendar
 * days and clock times are South African (Africa/Johannesburg, UTC+2, no DST),
 * matching `listing_viewing_slots()` in the database.
 */
import type { PresenceBadge } from "@/features/presence/presence-status";

/** Length of one bookable viewing slot; mirrors the database slot generator. */
export const VIEWING_SLOT_MINUTES = 30;

export type ViewingSlot = { start: string; end: string };
export type ViewingSlotDay = { key: string; slots: ViewingSlot[] };

export type LandlordAvailability = {
  tone: "available" | "busy" | "offline";
  label: string;
  detail: string;
  /** True only when the landlord can plausibly be at the property within 15 minutes. */
  canMeetSoon: boolean;
};

const TIME_ZONE = "Africa/Johannesburg";
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIME_ZONE });
const dayPartsFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE });
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TIME_ZONE });

export function formatSlotTime(value: string) {
  return timeFormat.format(Date.parse(value));
}

export function formatSlotDay(value: string) {
  const parts = Object.fromEntries(dayPartsFormat.formatToParts(Date.parse(value)).map(part => [part.type, part.value]));
  return { weekday: parts.weekday ?? "", day: parts.day ?? "", month: parts.month ?? "" };
}

/** "Tue 8 Jan at 14:30", used on the confirm button and in notifications. */
export function formatSlotRequest(value: string) {
  const { weekday, day, month } = formatSlotDay(value);
  return `${weekday} ${day} ${month} at ${formatSlotTime(value)}`;
}

/** Groups slots into SAST calendar days, both in chronological order. Unreadable times are dropped. */
export function groupSlotsByDay(slots: ViewingSlot[]): ViewingSlotDay[] {
  const readable = slots
    .map(slot => ({ slot, at: Date.parse(slot.start) }))
    .filter(entry => Number.isFinite(entry.at))
    .sort((a, b) => a.at - b.at);
  const days = new Map<string, ViewingSlot[]>();
  for (const { slot, at } of readable) {
    const key = dayKeyFormat.format(at);
    days.set(key, [...(days.get(key) ?? []), slot]);
  }
  return [...days].map(([key, daySlots]) => ({ key, slots: daySlots }));
}

export type CalendarDay = ViewingSlotDay & { weekday: string; day: string; month: string };

const keyLabelFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Every day from the first to the last open day, so days with no open times show as gaps. */
export function calendarDays(slots: ViewingSlot[]): CalendarDay[] {
  const days = groupSlotsByDay(slots);
  const firstDay = days[0], lastDay = days.at(-1);
  if (!firstDay || !lastDay) return [];
  const byKey = new Map(days.map(day => [day.key, day.slots]));
  const first = Date.parse(`${firstDay.key}T00:00:00Z`), last = Date.parse(`${lastDay.key}T00:00:00Z`);
  const result: CalendarDay[] = [];
  for (let at = first; at <= last; at += 86_400_000) {
    const key = new Date(at).toISOString().slice(0, 10);
    const parts = Object.fromEntries(keyLabelFormat.formatToParts(at).map(part => [part.type, part.value]));
    result.push({ key, slots: byKey.get(key) ?? [], weekday: parts.weekday ?? "", day: parts.day ?? "", month: parts.month ?? "" });
  }
  return result;
}

/**
 * What a renter sees about whether the landlord can make a short-notice showing.
 * "Available" presence alone is not enough when the landlord has set viewing
 * hours and it is currently outside them.
 */
export function describeLandlordAvailability(input: {
  presence: PresenceBadge | null | undefined;
  hasHours: boolean;
  inHoursNow: boolean;
  nextSlot: string | null;
}): LandlordAvailability {
  const { presence, hasHours, inHoursNow, nextSlot } = input;
  if (presence === "available" && (!hasHours || inHoursNow)) {
    return { tone: "available", canMeetSoon: true, label: "Available now", detail: "Can meet you at the property within 15 minutes." };
  }
  if (presence === "available") {
    return {
      tone: "busy", canMeetSoon: false, label: "Online, outside viewing hours",
      detail: nextSlot ? `Next open time: ${formatSlotRequest(nextSlot)}.` : "Pick a time below or send a message.",
    };
  }
  if (presence === "busy") {
    return {
      tone: "busy", canMeetSoon: false, label: "Recently active",
      detail: hasHours ? "May not make it within 15 minutes. Booking a time below is more reliable." : "May not make it within 15 minutes.",
    };
  }
  return {
    tone: "offline", canMeetSoon: false, label: "Offline",
    detail: hasHours ? "Won't make it within 15 minutes. Book one of their viewing times below." : "Unlikely to make it within 15 minutes. Send a message to agree a time.",
  };
}

/** One weekly viewing window: `weekday` 0 = Sunday, minutes from SAST midnight. */
export type ViewingHour = { weekday: number; startMinute: number; endMinute: number };

export function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]), minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/**
 * Mirrors the `landlord_viewing_hours` (and `service_hours`) table constraints so the form can
 * explain a rejection. Windows sit on the half-hour grid and must hold at least one slot.
 */
export function validateViewingHours(hours: ViewingHour[], slotMinutes = VIEWING_SLOT_MINUTES): { ok: true; hours: ViewingHour[] } | { ok: false; error: string } {
  const seen = new Set<number>();
  for (const hour of hours) {
    if (![hour.weekday, hour.startMinute, hour.endMinute].every(Number.isInteger)
      || hour.weekday < 0 || hour.weekday > 6 || hour.startMinute < 0 || hour.endMinute > 1440) {
      return { ok: false, error: "Viewing hours are out of range." };
    }
    if (seen.has(hour.weekday)) return { ok: false, error: "Set one window per day." };
    seen.add(hour.weekday);
    if (hour.endMinute - hour.startMinute < slotMinutes) {
      const span = slotMinutes === 60 ? "an hour" : `${slotMinutes} minutes`;
      return { ok: false, error: `Each day needs at least ${span} between start and end.` };
    }
    if (hour.startMinute % VIEWING_SLOT_MINUTES || hour.endMinute % VIEWING_SLOT_MINUTES) {
      return { ok: false, error: "Use times on the hour or half hour." };
    }
  }
  return { ok: true, hours: [...hours].sort((a, b) => a.weekday - b.weekday) };
}
