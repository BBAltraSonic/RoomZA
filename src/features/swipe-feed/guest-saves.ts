import { localStore, readJson, writeJson } from "./browser-storage";

/**
 * ♡ for signed-out visitors. Saves stay on this device so swiping never
 * redirects to sign-in, and are posted to favourites once the visitor signs in.
 */
export const GUEST_SAVES_KEY = "pinpoint.feed.guest-saves.v1";

export type GuestSave = { id: string; listingType?: "rent" | "sale" };

export function readGuestSaves(storage: Storage | null = localStore()): GuestSave[] {
  const value = readJson(storage, GUEST_SAVES_KEY);
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): GuestSave[] => {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string") return [];
    const listingType = entry.listingType === "rent" || entry.listingType === "sale" ? entry.listingType : undefined;
    return [listingType ? { id: entry.id, listingType } : { id: entry.id }];
  });
}

export function addGuestSave(save: GuestSave, storage: Storage | null = localStore()) {
  const saves = readGuestSaves(storage);
  if (saves.some((entry) => entry.id === save.id)) return;
  writeJson(storage, GUEST_SAVES_KEY, [...saves, save]);
}

export function removeGuestSave(id: string, storage: Storage | null = localStore()) {
  writeJson(storage, GUEST_SAVES_KEY, readGuestSaves(storage).filter((entry) => entry.id !== id));
}

/**
 * Posts every guest save through `save` (the favourites API) and keeps only the
 * ones that failed, so a later sign-in or retry can finish the merge.
 */
export async function mergeGuestSaves(
  save: (entry: GuestSave) => Promise<boolean>,
  storage: Storage | null = localStore(),
): Promise<{ merged: string[]; failed: string[] }> {
  const saves = readGuestSaves(storage);
  const outcomes = await Promise.all(
    saves.map(async (entry) => {
      try {
        return { entry, ok: await save(entry) };
      } catch {
        return { entry, ok: false };
      }
    }),
  );
  const merged = outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.entry.id);
  const failed = outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.entry);
  writeJson(storage, GUEST_SAVES_KEY, failed);
  return { merged, failed: failed.map((entry) => entry.id) };
}
