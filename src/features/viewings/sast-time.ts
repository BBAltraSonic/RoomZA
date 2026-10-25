const sastOffsetMs = 2 * 60 * 60 * 1000;
const dayFormat = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "Africa/Johannesburg" });
const timeFormat = new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Africa/Johannesburg" });

export function formatViewingDay(value: string) {
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? dayFormat.format(instant) : "Date unavailable";
}

export function formatViewingTime(value: string) {
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? `${timeFormat.format(instant)} SAST` : "Time unavailable";
}

export function viewingTimeInput(value: string | null) {
  if (!value) return "";
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) return "";
  return new Date(instant + sastOffsetMs).toISOString().slice(0, 16);
}

export function viewingTimeInstant(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+02:00`);
  if (!Number.isFinite(date.getTime()) || viewingTimeInput(date.toISOString()) !== value) return null;
  return date.toISOString();
}

// Calendar dates represent the selected day in the device's calendar. The
// property appointment time itself is always entered in South African time.
export function viewingCalendarInstant(date: Date, time: string) {
  if (!Number.isFinite(date.getTime())) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return viewingTimeInstant(`${day}T${time}`);
}
