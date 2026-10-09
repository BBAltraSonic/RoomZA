export const NAVIGATION_IDENTITY_EVENT = "pinpoint:account-identity";

/** In-memory display stores must discard the previous user's state immediately. */
export function publishNavigationIdentity(userId: string | null) {
  window.dispatchEvent(new CustomEvent(NAVIGATION_IDENTITY_EVENT, { detail: { userId } }));
}
