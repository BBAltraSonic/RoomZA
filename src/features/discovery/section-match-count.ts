import type { SectionSearch } from "@/features/assistant/section-intent";

import { feedQuickItem } from "./section-quick-chips";
import { applySectionQuick } from "./section-quick-filters";
import type { ViewportResponse } from "./viewport-contract";

type FeedItem = ViewportResponse["items"][number];

export type SectionCountContext = {
  /** The search words and service type the feed on screen was fetched with. */
  query: string;
  serviceType: string;
  /** The map area's feed before quick filters, or undefined while it loads. */
  items: readonly FeedItem[] | undefined;
  now: Date;
  openNowIds: ReadonlySet<string> | null;
  belowNearbyIds: ReadonlySet<string>;
  /** The same map area's feed for other words or service type; null when it can't be read. */
  fetchItems: (query: string, serviceType: string) => Promise<readonly FeedItem[] | null>;
  belowNearbyFor: (items: readonly FeedItem[]) => ReadonlySet<string>;
};

const ALL_SERVICES = "All services";

/**
 * How many results a changed section search would find in the same map area, for Piko's
 * no-results rescue. Quick filters are applied on the device, as the results list does, so a
 * quick-filter change costs nothing; a change of words or service type reads the feed once.
 */
export async function countSectionMatches(next: SectionSearch, context: SectionCountContext): Promise<number | null> {
  const serviceType = next.serviceType ?? ALL_SERVICES;
  const sameFeed = next.text === context.query && serviceType === context.serviceType;
  const items = sameFeed ? context.items : await context.fetchItems(next.text, serviceType);
  if (!items) return null;
  return applySectionQuick(items, next.quick, feedQuickItem, {
    now: context.now,
    // "Open now" was only looked up for the feed on screen. For another feed it can't hide
    // anything yet, so that count may be a little high until the search is applied.
    openNowIds: sameFeed ? context.openNowIds : null,
    belowNearbyIds: sameFeed ? context.belowNearbyIds : context.belowNearbyFor(items),
  }).length;
}
