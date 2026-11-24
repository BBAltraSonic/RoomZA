import { answerListingFact, type FactListing } from "./listing-facts";

/**
 * Compare (proposal, template "Compare"): 2–3 listings side by side, from the listings' own
 * fields. A value the listing doesn't state reads "Not listed", never a guess.
 */

export const MAX_COMPARE = 3;

export function toggleCompare(ids: readonly string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((value) => value !== id);
  return ids.length >= MAX_COMPARE ? [...ids] : [...ids, id];
}

export type CompareRow = {
  label: string;
  values: string[];
  /** Indexes of the listings with the best value, when one is clearly better. */
  best: number[];
};

const NOT_LISTED = "Not listed";

function rand(value: number) {
  return `R${Math.round(value).toLocaleString("en-US")}`;
}

function bestBy(numbers: (number | null)[], prefer: "low" | "high"): number[] {
  const present = numbers.filter((value): value is number => value !== null);
  if (present.length < 2 || new Set(present).size === 1) return [];
  const target = prefer === "low" ? Math.min(...present) : Math.max(...present);
  return numbers.flatMap((value, index) => (value === target ? [index] : []));
}

function factValue(listing: FactListing, topic: Parameters<typeof answerListingFact>[1], now: Date) {
  const fact = answerListingFact(listing, topic, now);
  return fact.known ? fact.answer.replace(/\.$/, "") : NOT_LISTED;
}

export function compareRows(listings: readonly FactListing[], now = new Date()): CompareRow[] {
  const prices = listings.map((listing) => listing.display_price ?? listing.price ?? null);
  const deposits = listings.map((listing) => listing.deposit_amount ?? null);
  const beds = listings.map((listing) => listing.bedrooms);
  const baths = listings.map((listing) => listing.bathrooms);
  return [
    {
      label: "Price",
      values: listings.map((listing, index) => {
        const price = prices[index];
        if (!price) return NOT_LISTED;
        return listing.listing_type === "sale" ? rand(price) : `${rand(price)} a month`;
      }),
      best: bestBy(prices, "low"),
    },
    { label: "Bedrooms", values: beds.map(String), best: bestBy(beds, "high") },
    { label: "Bathrooms", values: baths.map(String), best: bestBy(baths, "high") },
    { label: "Deposit", values: deposits.map((deposit) => (deposit ? rand(deposit) : NOT_LISTED)), best: bestBy(deposits, "low") },
    { label: "Furnished", values: listings.map((listing) => (answerListingFact(listing, "furnished").known ? "Yes" : NOT_LISTED)), best: [] },
    {
      label: "Parking",
      values: listings.map((listing) => (listing.parking_type === "none" || listing.parking_count <= 0 ? "None" : `${listing.parking_count} bay${listing.parking_count === 1 ? "" : "s"}`)),
      best: [],
    },
    { label: "Electricity", values: listings.map((listing) => factValue(listing, "electricity", now)), best: [] },
    { label: "Wi-Fi", values: listings.map((listing) => factValue(listing, "wifi", now)), best: [] },
    {
      label: "Move in",
      values: listings.map((listing) => {
        const fact = answerListingFact(listing, "move-in", now);
        if (!fact.known) return NOT_LISTED;
        return fact.answer === "Available now." ? "Now" : fact.answer.replace(/^Available from /, "").replace(/\.$/, "");
      }),
      best: [],
    },
    { label: "Lease", values: listings.map((listing) => factValue(listing, "lease", now).replace(/^The lease is /, "")), best: [] },
  ];
}
