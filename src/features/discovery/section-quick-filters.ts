import type { ViewportCategory } from "./viewport-contract";

/**
 * Quick filters for the Specials, Places and Events sections (proposal, "Quick filters").
 * Fixed per section, never chosen by the AI, and several can be on at once. They live in the
 * `quick` address parameter and filter the map area's feed on the device, so pins and results
 * follow them together.
 */

export const SECTION_QUICK_KEYS = [
  "ending-today",
  "new-this-week",
  "on-now",
  "tonight",
  "this-weekend",
  "free",
] as const;
export type SectionQuickKey = (typeof SECTION_QUICK_KEYS)[number];

export const SECTION_QUICK_FILTERS: Record<ViewportCategory, readonly SectionQuickKey[]> = {
  shopping: ["ending-today", "new-this-week"],
  tourism: ["new-this-week"],
  event: ["on-now", "tonight", "this-weekend", "free"],
};

const LABELS: Record<SectionQuickKey, string> = {
  "ending-today": "Ending today",
  "new-this-week": "New this week",
  "on-now": "On now",
  tonight: "Tonight",
  "this-weekend": "This weekend",
  free: "Free",
};

export function sectionQuickLabel(key: SectionQuickKey) {
  return LABELS[key];
}

export function parseSectionQuick(value: string | null, category: ViewportCategory): SectionQuickKey[] {
  if (!value) return [];
  const allowed = SECTION_QUICK_FILTERS[category];
  const keys = new Set<SectionQuickKey>();
  for (const part of value.split(",")) {
    if ((allowed as readonly string[]).includes(part)) keys.add(part as SectionQuickKey);
  }
  return [...keys];
}

export function toggleSectionQuick(active: readonly SectionQuickKey[], key: SectionQuickKey): SectionQuickKey[] {
  return active.includes(key) ? active.filter((value) => value !== key) : [...active, key];
}

// South Africa keeps UTC+2 all year, so local wall-clock times are a fixed shift.
const SAST_OFFSET_MS = 2 * 3_600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** Midnight at the start of the South African day containing `now`, as a UTC instant. */
function startOfSastDay(now: Date) {
  const local = now.getTime() + SAST_OFFSET_MS;
  return new Date(local - (local % DAY_MS) - SAST_OFFSET_MS);
}

function sastWeekday(now: Date) {
  return new Date(now.getTime() + SAST_OFFSET_MS).getUTCDay();
}

export type TimeWindow = { start: Date; end: Date };

/** 17:00 until midnight today, South African time. Starts now if the evening has begun. */
export function tonightWindow(now: Date): TimeWindow {
  const midnight = startOfSastDay(now);
  const evening = new Date(midnight.getTime() + 17 * 3_600_000);
  return { start: now > evening ? now : evening, end: new Date(midnight.getTime() + DAY_MS) };
}

/** Friday 17:00 until Sunday midnight, South African time. Starts now during the weekend. */
export function weekendWindow(now: Date): TimeWindow {
  const weekday = sastWeekday(now);
  const midnight = startOfSastDay(now).getTime();
  // Days from today back (weekend) or forward (weekday) to this week's Friday.
  const toFriday = weekday === 0 ? -2 : weekday === 6 ? -1 : 5 - weekday;
  const fridayEvening = new Date(midnight + toFriday * DAY_MS + 17 * 3_600_000);
  const mondayMidnight = new Date(midnight + (toFriday + 3) * DAY_MS);
  return { start: now > fridayEvening ? now : fridayEvening, end: mondayMidnight };
}

export type SectionQuickItem =
  | { kind: "offer"; id: string; startsAt: string; endsAt: string; publishedAt: string }
  | { kind: "entry"; id: string; startsAt: string; endsAt: string; publishedAt: string; live: boolean; priceCents?: number };

export type SectionQuickContext = { now: Date };

function overlaps(item: { startsAt: string; endsAt: string }, window: TimeWindow) {
  const start = Date.parse(item.startsAt);
  const end = Date.parse(item.endsAt);
  return Number.isFinite(start) && Number.isFinite(end) && start < window.end.getTime() && end > window.start.getTime();
}

export function matchesSectionQuick(item: SectionQuickItem, key: SectionQuickKey, context: SectionQuickContext): boolean {
  switch (key) {
    case "ending-today": {
      const end = Date.parse(item.endsAt);
      return Number.isFinite(end) && end <= startOfSastDay(context.now).getTime() + DAY_MS;
    }
    case "new-this-week": {
      const published = Date.parse(item.publishedAt);
      return Number.isFinite(published) && context.now.getTime() - published <= WEEK_MS;
    }
    case "on-now":
      return item.kind === "entry" && item.live;
    case "tonight":
      return overlaps(item, tonightWindow(context.now));
    case "this-weekend":
      return overlaps(item, weekendWindow(context.now));
    case "free":
      return item.kind === "entry" && item.priceCents === 0;
  }
}

export function applySectionQuick<T>(
  items: readonly T[],
  keys: readonly SectionQuickKey[],
  toQuickItem: (item: T) => SectionQuickItem,
  context: SectionQuickContext,
): T[] {
  if (!keys.length) return [...items];
  return items.filter((item) => {
    const quickItem = toQuickItem(item);
    return keys.every((key) => matchesSectionQuick(quickItem, key, context));
  });
}
