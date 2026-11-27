"use client";

import { useSyncExternalStore } from "react";

import { localStore, sessionStore, subscribeToKey } from "./browser-storage";
import { GUEST_SAVES_KEY, readGuestSaves } from "./guest-saves";
import { readSessionPasses, SESSION_PASSES_KEY } from "./session-passes";

/**
 * What the feed has marked, for the surfaces around it: the map dims passed
 * pins (requirement 3.5) and the favourites chip counts guest saves. Kept apart
 * from `feed-view.tsx` so reading them does not load the feed's chunk.
 */

const NONE: ReadonlySet<string> = new Set();

function idSetStore(key: string, storage: () => Storage | null, read: (storage: Storage | null) => string[]) {
  let raw: string | null = null;
  let snapshot = NONE;
  const getSnapshot = () => {
    const store = storage();
    let next: string | null = null;
    try {
      next = store?.getItem(key) ?? null;
    } catch {
      next = null;
    }
    // A new Set only when the stored value changed, so subscribers do not re-render for nothing.
    if (next !== raw) {
      raw = next;
      const ids = read(store);
      snapshot = ids.length > 0 ? new Set(ids) : NONE;
    }
    return snapshot;
  };
  const subscribe = (onChange: () => void) => subscribeToKey(key, onChange);
  return { getSnapshot, subscribe };
}

const passes = idSetStore(SESSION_PASSES_KEY, sessionStore, readSessionPasses);
const guestSaves = idSetStore(GUEST_SAVES_KEY, localStore, (store) => readGuestSaves(store).map((save) => save.id));
const serverSnapshot = () => NONE;

/** Listings passed with ✕ in this browser session. */
export function usePassedListingIds(): ReadonlySet<string> {
  return useSyncExternalStore(passes.subscribe, passes.getSnapshot, serverSnapshot);
}

/** Listings a signed-out visitor saved with ♡ on this device. */
export function useGuestSaveIds(): ReadonlySet<string> {
  return useSyncExternalStore(guestSaves.subscribe, guestSaves.getSnapshot, serverSnapshot);
}
