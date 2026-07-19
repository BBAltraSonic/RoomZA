const NEW_LISTING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A listing is new for its first seven days. Future or malformed timestamps do
 * not receive the badge, avoiding misleading labels from bad source data.
 */
export function isNewListing(createdAt?: string | null, now = Date.now()) {
  if (!createdAt) return false;

  const createdAtMs = new Date(createdAt).getTime();
  const age = now - createdAtMs;
  return Number.isFinite(createdAtMs) && age >= 0 && age < NEW_LISTING_WINDOW_MS;
}
