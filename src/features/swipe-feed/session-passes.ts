import { readJson, sessionStore, writeJson } from "./browser-storage";

/** ✕ hides a listing for this browser session only (requirement 3.5). */
export const SESSION_PASSES_KEY = "pinpoint.feed.passed.v1";
export const SESSION_PASSES_LIMIT = 500;

export function readSessionPasses(storage: Storage | null = sessionStore()): string[] {
  const value = readJson(storage, SESSION_PASSES_KEY);
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

export function writeSessionPasses(ids: Iterable<string>, storage: Storage | null = sessionStore()) {
  writeJson(storage, SESSION_PASSES_KEY, [...ids].slice(-SESSION_PASSES_LIMIT));
}
