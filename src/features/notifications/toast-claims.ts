import type { NotificationItem } from "./inbox-contract";

/**
 * Something on screen that announces some notifications itself (Piko in the dock announces saved
 * search matches). While a claim says yes, the live toast stays quiet so the person isn't told twice.
 */
export type ToastClaim = (item: NotificationItem) => boolean;

const claims = new Set<ToastClaim>();

/** Adds a claim; the returned function removes it. */
export function claimToasts(claim: ToastClaim): () => void {
  claims.add(claim);
  return () => { claims.delete(claim); };
}

export function isToastClaimed(item: NotificationItem): boolean {
  for (const claim of claims) if (claim(item)) return true;
  return false;
}
