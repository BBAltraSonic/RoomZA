import type { SectionSearch } from "@/features/assistant/section-intent";

import { feedQuickItem } from "./section-quick-chips";
import { applySectionQuick } from "./section-quick-filters";
import type { ViewportResponse } from "./viewport-contract";

type FeedItem = ViewportResponse["items"][number];

export type SectionCountContext = {
  /** The search words the feed on screen was fetched with. */
  query: string;
  /** The map area's feed before quick filters, or undefined while it loads. */
  items: readonly FeedItem[] | undefined;
  now: Date;
  /** The same map area's feed for other words; null when it can't be read. */
  fetchItems: (query: string) => Promise<readonly FeedItem[] | null>;
};

/**
 * How many results a changed section search would find in the same map area, for Piko's
 * no-results rescue. Quick filters are applied on the device, as the results list does, so a
 * quick-filter change costs nothing; a change of words reads the feed once.
 */
export async function countSectionMatches(next: SectionSearch, context: SectionCountContext): Promise<number | null> {
  const items = next.text === context.query ? context.items : await context.fetchItems(next.text);
  if (!items) return null;
  return applySectionQuick(items, next.quick, feedQuickItem, { now: context.now }).length;
}
