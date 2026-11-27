/**
 * Storage access that never throws: private browsing, blocked cookies and
 * server rendering all make Web Storage unavailable, and the feed must still work.
 */

export function sessionStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function localStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readJson(storage: Storage | null, key: string): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

const listeners = new Map<string, Set<() => void>>();

/**
 * Calls `onChange` whenever `key` is written in this tab, or in another tab
 * (the `storage` event, which only localStorage fires across tabs).
 */
export function subscribeToKey(key: string, onChange: () => void): () => void {
  const forKey = listeners.get(key) ?? new Set();
  listeners.set(key, forKey);
  forKey.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    forKey.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function writeJson(storage: Storage | null, key: string, value: unknown) {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage blocked: the feed keeps working in memory.
    return;
  }
  listeners.get(key)?.forEach((onChange) => onChange());
}
