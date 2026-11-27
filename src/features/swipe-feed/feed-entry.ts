/**
 * Whether discovery shows the feed, and at which listing. `view=feed` opens it
 * at the first result; `listingId` or a `/listing/[id]` page opens it at that
 * listing, which the feed reports as unavailable if it is gone (requirement 8.3).
 */
export function feedEntry({ enabled, searchParams, pathname, routeListingId }: {
  enabled: boolean;
  searchParams: Pick<URLSearchParams, "get">;
  pathname: string;
  /** The id in `/listing/[id]`, passed whether or not that listing still exists. */
  routeListingId?: string | null;
}): { open: boolean; target: string | null } {
  const linked = searchParams.get("listingId");
  const routed = pathname.startsWith("/listing/") ? routeListingId ?? null : null;
  const target = linked ?? routed;
  return { open: enabled && (searchParams.get("view") === "feed" || Boolean(target)), target };
}
