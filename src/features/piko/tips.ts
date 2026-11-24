import { isNewListing } from "@/features/listings/listing-freshness";

/**
 * Piko's tips while browsing (docs/piko-character-bible.md, Phase 2 step 5). Computed from the
 * item's own data and the results around it, never written by the AI, and at most one per item:
 * the most urgent wins.
 */

export type TipInput = {
  now: Date;
  /** When a special, event or place ends. */
  endsAt?: string;
  /** When the item went live, for "New this week". */
  publishedAt?: string | null;
  /** How far below the typical price of comparable results nearby, in rands. */
  belowNearby?: { amount: number; peers: string };
};

const ZONE = "Africa/Johannesburg";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hour12: false });

/** Rents to the nearest R50, sale prices to the nearest R1,000, so a tip never looks falsely exact. */
function roundRands(amount: number) {
  const step = amount >= 10_000 ? 1_000 : 50;
  return Math.round(amount / step) * step;
}

export function pikoTip({ now, endsAt, publishedAt, belowNearby }: TipInput): string | null {
  if (endsAt) {
    const end = new Date(endsAt);
    if (end.getTime() > now.getTime() && dayKey.format(end) === dayKey.format(now)) return `Ends today at ${clock.format(end)}`;
  }
  if (belowNearby) {
    const amount = roundRands(belowNearby.amount);
    if (amount > 0) return `R${amount.toLocaleString("en-US")} below similar ${belowNearby.peers} nearby`;
  }
  if (isNewListing(publishedAt, now.getTime())) return "New this week";
  return null;
}
