import { sectionQuickLabel } from "@/features/discovery/section-quick-filters";

import type { SectionSearch } from "./section-intent";

/**
 * No-results rescue for the Specials, Places and Events chats
 * (docs/piko-character-bible.md, Phase 2 step 3). When a search finds nothing, Piko tries
 * dropping one part of it at a time, counts what each finds in the same map area, and offers the
 * one that finds the most. Plain code: the counts come from Pinpoint's own feed, never the AI.
 */

export type SectionRescueCandidate = {
  /** What is dropped, as the person sees it: "Tonight", "“jazz”", "Plumbing". */
  without: string;
  next: SectionSearch;
};

export type SectionRescue = SectionRescueCandidate & { count: number };

/**
 * One candidate per removable part, cheapest to check first: quick filters (counted on the
 * device), then the search words. The Nearest sort only orders results,
 * so dropping it never finds more.
 */
export function sectionRescueCandidates(search: SectionSearch): SectionRescueCandidate[] {
  const candidates: SectionRescueCandidate[] = search.quick.map((key) => ({
    without: sectionQuickLabel(key),
    next: { ...search, quick: search.quick.filter((value) => value !== key) },
  }));
  if (search.text) candidates.push({ without: `“${search.text}”`, next: { ...search, text: "" } });
  return candidates;
}

/** The candidate that finds the most; the earlier one on a tie. Null when none finds anything. */
export function pickSectionRescue(candidates: readonly SectionRescueCandidate[], counts: readonly (number | null)[]): SectionRescue | null {
  let best: SectionRescue | null = null;
  candidates.forEach((candidate, index) => {
    const count = counts[index];
    if (typeof count === "number" && count > 0 && (!best || count > best.count)) best = { ...candidate, count };
  });
  return best;
}
