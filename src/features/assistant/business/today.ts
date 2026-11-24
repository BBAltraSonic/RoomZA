/**
 * The Today screen (proposal, "Today"). Plain counts and reminders, no AI. Only what the lister
 * actually has is shown, and a count that failed to load says so; it is never shown as zero.
 */

export const TODAY_KEYS = [
  "enquiriesWaiting",
  "applicationsToReview",
  "viewingRequests",
  "bookingRequests",
  "followUps",
  "listingsNeedingInfo",
  "expiringSpecials",
] as const;
export type TodayKey = (typeof TODAY_KEYS)[number];

export type TodayCounts = Record<TodayKey, number | null>;

/** What the lister has, so landlords see enquiries, providers see bookings, retailers see specials. */
export type ListerHas = { rentals: boolean; sales: boolean; services: boolean; specials: boolean };

const RELEVANT: Record<TodayKey, (has: ListerHas) => boolean> = {
  enquiriesWaiting: (has) => has.rentals || has.sales,
  applicationsToReview: (has) => has.rentals,
  viewingRequests: (has) => has.rentals || has.sales,
  bookingRequests: (has) => has.services,
  followUps: (has) => has.rentals || has.sales || has.services,
  listingsNeedingInfo: (has) => has.rentals || has.sales,
  expiringSpecials: (has) => has.specials,
};

const WORDING: Record<TodayKey, { one: string; many: string; action: string; failed: string }> = {
  enquiriesWaiting: { one: "enquiry waiting on you", many: "enquiries waiting on you", action: "Open", failed: "Enquiries couldn't load" },
  applicationsToReview: { one: "application to review", many: "applications to review", action: "Open", failed: "Applications couldn't load" },
  viewingRequests: { one: "viewing request to answer", many: "viewing requests to answer", action: "Open", failed: "Viewing requests couldn't load" },
  bookingRequests: { one: "booking request to answer", many: "booking requests to answer", action: "Open", failed: "Bookings couldn't load" },
  followUps: { one: "person ready for follow-up", many: "people ready for follow-up", action: "Open", failed: "Follow-ups couldn't load" },
  listingsNeedingInfo: { one: "listing missing important info", many: "listings missing important info", action: "Fix", failed: "Listing checks couldn't load" },
  expiringSpecials: { one: "special ending in the next 3 days", many: "specials ending in the next 3 days", action: "Open", failed: "Specials couldn't load" },
};

export type TodayItem = { key: TodayKey; count: number; label: string; action: string };
export type TodayNote = { key: TodayKey; message: string };

export function buildToday(counts: TodayCounts, has: ListerHas): { items: TodayItem[]; notes: TodayNote[]; badge: number } {
  const items: TodayItem[] = [];
  const notes: TodayNote[] = [];
  for (const key of TODAY_KEYS) {
    if (!RELEVANT[key](has)) continue;
    const count = counts[key];
    if (count === null) {
      notes.push({ key, message: `${WORDING[key].failed}, try again` });
      continue;
    }
    if (count <= 0) continue;
    items.push({ key, count, label: `${count} ${count === 1 ? WORDING[key].one : WORDING[key].many}`, action: WORDING[key].action });
  }
  const badge = items.filter((item) => item.key !== "listingsNeedingInfo").reduce((total, item) => total + item.count, 0);
  return { items, notes, badge };
}
