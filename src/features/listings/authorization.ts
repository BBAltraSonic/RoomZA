export const LISTING_OWNERSHIP_DENIED_MESSAGE = "Listing not found or access denied.";

export type OwnershipDecision =
  | { allowed: true }
  | { allowed: false; error: typeof LISTING_OWNERSHIP_DENIED_MESSAGE };

export function authorizeOwnedListing(ownerId: string | null | undefined, userId: string): OwnershipDecision {
  if (ownerId === userId) {
    return { allowed: true };
  }

  return { allowed: false, error: LISTING_OWNERSHIP_DENIED_MESSAGE };
}
