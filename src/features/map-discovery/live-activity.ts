export type ListingLiveActivity = {
  viewedToday: number;
  viewingNow: number;
  lastScheduledAt: string | null;
  lastRentedAt: string | null;
};

export type LiveActivitySignal = {
  kind: "viewing_now" | "viewed_today" | "scheduled" | "rented";
  label: string;
};

function validCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function roundedActivityCount(value: number) {
  const count = validCount(value);
  if (count < 10) return 5;
  return Math.max(10, Math.round(count / 5) * 5);
}

function ageMs(value: string | null, now: number) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, now - timestamp) : null;
}

export function selectLiveActivitySignals(
  activity?: ListingLiveActivity | null,
  now = Date.now(),
): LiveActivitySignal[] {
  if (!activity) return [];

  const signals: LiveActivitySignal[] = [];
  const viewingNow = validCount(activity.viewingNow);
  const viewedToday = validCount(activity.viewedToday);

  if (viewingNow >= 2) {
    signals.push({
      kind: "viewing_now",
      label:
        viewingNow < 5
          ? "A few people are viewing now"
          : `About ${roundedActivityCount(viewingNow)} viewing now`,
    });
  }

  if (viewedToday >= 4) {
    signals.push({
      kind: "viewed_today",
      label: `About ${roundedActivityCount(viewedToday)} views today`,
    });
  }

  const scheduledAge = ageMs(activity.lastScheduledAt, now);
  if (scheduledAge !== null && scheduledAge <= 90 * 60_000) {
    signals.push({ kind: "scheduled", label: "A viewing was just arranged" });
  }

  const rentedAge = ageMs(activity.lastRentedAt, now);
  if (rentedAge !== null && rentedAge <= 30 * 24 * 60 * 60_000) {
    const days = Math.max(1, Math.round(rentedAge / (24 * 60 * 60_000)));
    signals.push({
      kind: "rented",
      label: `A home here rented ${days} ${days === 1 ? "day" : "days"} ago`,
    });
  }

  return signals.slice(0, 2);
}
