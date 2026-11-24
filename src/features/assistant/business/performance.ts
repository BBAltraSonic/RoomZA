import type { QualityIssue } from "./quality";

/**
 * "How are my listings doing?" (proposal, capability 4). Stat tiles, a funnel per listing,
 * suggestion cards with one action each and a comparison with similar listings nearby.
 * Plain queries and rules, no AI.
 */

export type FunnelCounts = { views: number | null; enquiries: number | null; viewings: number | null; applications: number | null };

export type ListingFunnel = { listingId: string; title: string; price: number | null; photoCount: number; counts: FunnelCounts };

export type Nearby = { listingId: string; similarCount: number; medianPrice: number | null; medianPhotos: number | null };

export type Suggestion = { listingId: string; title: string; message: string; action: string; href: string };

export type StatTile = { label: string; value: string; note?: string };

function sum(values: (number | null)[]): number | null {
  return values.some((value) => value === null) ? null : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function formatMinutes(seconds: number) {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86_400)} days`;
}

/** Totals across listings. A total with any failed part says so rather than undercounting. */
export function statTiles(funnels: readonly ListingFunnel[], medianReplySeconds: number | null): StatTile[] {
  const tile = (label: string, value: number | null): StatTile => (value === null ? { label, value: "—", note: "Couldn't load" } : { label, value: value.toLocaleString("en-US") });
  return [
    tile("Views (30 days)", sum(funnels.map((funnel) => funnel.counts.views))),
    tile("Enquiries", sum(funnels.map((funnel) => funnel.counts.enquiries))),
    tile("Viewings", sum(funnels.map((funnel) => funnel.counts.viewings))),
    tile("Applications", sum(funnels.map((funnel) => funnel.counts.applications))),
    medianReplySeconds === null ? { label: "Typical reply time", value: "—", note: "Not enough replies yet" } : { label: "Typical reply time", value: formatMinutes(medianReplySeconds) },
  ];
}

export function funnelSteps(counts: FunnelCounts) {
  return [
    { label: "Views", value: counts.views },
    { label: "Enquiries", value: counts.enquiries },
    { label: "Viewings", value: counts.viewings },
    { label: "Applications", value: counts.applications },
  ];
}

function rand(value: number) {
  return `R${Math.round(value).toLocaleString("en-US")}`;
}

/** One recommendation per card, each with one existing action. */
export function suggestions(funnels: readonly ListingFunnel[], issues: ReadonlyMap<string, readonly QualityIssue[]>, nearby: ReadonlyMap<string, Nearby>): Suggestion[] {
  const result: Suggestion[] = [];
  for (const funnel of funnels) {
    const listingIssues = issues.get(funnel.listingId) ?? [];
    const viewingHours = listingIssues.find((issue) => issue.key === "no-viewing-hours");
    if (viewingHours) result.push({ listingId: funnel.listingId, title: funnel.title, message: "No viewing hours set, so people can't book a time", action: viewingHours.fix, href: viewingHours.href });
    const comparison = nearby.get(funnel.listingId);
    if (comparison?.medianPhotos !== null && comparison?.medianPhotos !== undefined && funnel.photoCount < comparison.medianPhotos) {
      result.push({ listingId: funnel.listingId, title: funnel.title, message: `${funnel.photoCount} photos; similar listings nearby have about ${comparison.medianPhotos}`, action: "Add photos", href: `/dashboard/listings/${funnel.listingId}/edit` });
    }
    const { views, enquiries } = funnel.counts;
    if (views !== null && enquiries !== null && views >= 30 && enquiries === 0) {
      const priceNote = comparison?.medianPrice && funnel.price && funnel.price > comparison.medianPrice * 1.1 ? ` Similar listings nearby ask about ${rand(comparison.medianPrice)}.` : "";
      result.push({ listingId: funnel.listingId, title: funnel.title, message: `${views} views but no enquiries yet.${priceNote}`, action: "Review listing", href: `/dashboard/listings/${funnel.listingId}/edit` });
    }
  }
  return result;
}

export function median(values: readonly number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}
