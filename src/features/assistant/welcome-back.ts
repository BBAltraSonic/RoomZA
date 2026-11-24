/**
 * Welcome back (docs/piko-character-bible.md, Phase 2 step 4). Pinpoint counts the homes that
 * match the person's last search and were listed after they last ran it. Plain code over the
 * listings API; nothing goes to the AI.
 */

/** Listings created strictly after `since`. Missing or unreadable dates never count. */
export function countNewSince(listings: readonly { createdAt?: string | null }[], since: string): number {
  const after = Date.parse(since);
  if (!Number.isFinite(after)) return 0;
  return listings.filter((listing) => {
    const created = Date.parse(listing.createdAt ?? "");
    return Number.isFinite(created) && created > after;
  }).length;
}
