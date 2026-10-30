const MAX_ENTRIES = 30;
const MAX_AGE_MS = 10 * 60 * 1000;

const entries = new Map<string, { value: unknown; storedAt: number }>();

/** Survives route changes so returning to a viewport paints before the network answers. */
export function readFeedCache<T>(key: string, now = Date.now()): T | undefined {
  const entry = entries.get(key);
  if (!entry) return undefined;
  entries.delete(key);
  if (now - entry.storedAt > MAX_AGE_MS) return undefined;
  entries.set(key, entry);
  return entry.value as T;
}

export function writeFeedCache(key: string, value: unknown, now = Date.now()) {
  entries.delete(key);
  entries.set(key, { value, storedAt: now });
  if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
}

export function clearFeedCache() {
  entries.clear();
}

/**
 * Keeps the identity of rows that did not change, so a refresh that returns the
 * same data re-renders nothing and a partial change re-renders only those rows.
 */
export function reuseStable<T>(previous: readonly T[], next: readonly T[], getId: (row: T) => string): T[] {
  const known = new Map(previous.map(row => [getId(row), row]));
  let unchanged = previous.length === next.length;
  const merged = next.map((row, index) => {
    const prior = known.get(getId(row));
    const same = prior !== undefined && JSON.stringify(prior) === JSON.stringify(row);
    if (!same || previous[index] !== prior) unchanged = false;
    return same ? prior : row;
  });
  return unchanged ? (previous as T[]) : merged;
}
