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

export function authorizeManagedListing(input: {
  ownerId: string | null | undefined;
  organizationId: string | null | undefined;
  userId: string;
  managedOrganizationId?: string | null;
}): OwnershipDecision {
  if (
    input.ownerId === input.userId
    || (
      input.organizationId
      && input.managedOrganizationId
      && input.organizationId === input.managedOrganizationId
    )
  ) {
    return { allowed: true };
  }
  return { allowed: false, error: LISTING_OWNERSHIP_DENIED_MESSAGE };
}
