import {
  applyChipsToParams,
  chipId,
  chipsFromParams,
  OWNED_PARAMS,
  type ReadonlyParams,
  type SearchChip,
} from "./search-intent";

/**
 * Customer memory (proposal, "Memory"). Kept by Pinpoint and never sent to the AI. It stores
 * chips (as a discovery address), never what was typed. Recent searches drop off after about
 * 90 days; preferences are saved only after the person confirms; saved searches stay until
 * removed. Guests keep it on their device; signed-in people keep it in their account
 * (`assistant_memory`), and a guest's memory moves there when they sign in.
 */

const STORAGE_KEY = "pinpoint:assistant-memory:v1";
const DEVICE_KEY = "pinpoint:assistant-device";
const RECENT_LIMIT = 8;
const SAVED_LIMIT = 10;
const DECLINED_LIMIT = 20;
const RECENT_MAX_AGE_MS = 90 * 86_400_000;
const OFFER_AFTER_SEARCHES = 2;
const QUERY_MAX_LENGTH = 500;

export type RecentSearch = { query: string; at: string };

export type AssistantMemory = {
  version: 1;
  recent: RecentSearch[];
  preferences: SearchChip[];
  /** Chip IDs the person said "Not now" to. They are not offered again. */
  declined: string[];
  saved: RecentSearch[];
};

export function emptyMemory(): AssistantMemory {
  return { version: 1, recent: [], preferences: [], declined: [], saved: [] };
}

export function isMemoryEmpty(memory: AssistantMemory) {
  return !memory.recent.length && !memory.preferences.length && !memory.declined.length && !memory.saved.length;
}

/** The chip-owned part of an address, in a stable order, keeping the chosen area's ID. */
export function searchQuery(params: ReadonlyParams): string {
  const chips = chipsFromParams(params);
  const canonical = applyChipsToParams(new URLSearchParams(), chips);
  const area = params.get("area");
  if (area && chips.some((chip) => chip.kind === "area")) {
    canonical.set("area", area);
    const areaId = params.get("areaId");
    if (areaId) canonical.set("areaId", areaId);
  }
  return canonical.toString();
}

/** Applies a stored search over the current address, replacing the current search. */
export function resumeQuery(current: ReadonlyParams, stored: string): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  for (const key of [...OWNED_PARAMS, "area", "areaId", "listingId", "placeId"]) params.delete(key);
  for (const [key, value] of new URLSearchParams(searchQuery(new URLSearchParams(stored)))) params.set(key, value);
  return params;
}

const PREFERENCE_KINDS = new Set(["quick", "type"]);

function preferenceFromId(id: unknown): SearchChip | null {
  if (typeof id !== "string") return null;
  const [kind, value] = id.split(":");
  if (!kind || !value || !PREFERENCE_KINDS.has(kind)) return null;
  const chip = chipsFromParams(new URLSearchParams({ [kind === "quick" ? "quick" : "type"]: value }))[0];
  return chip ?? null;
}

function parseSearches(value: unknown, now: Date, maxAgeMs: number | null, limit: number): RecentSearch[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .flatMap((entry): RecentSearch[] => {
      if (!entry || typeof entry !== "object") return [];
      const { query, at } = entry as Record<string, unknown>;
      if (typeof query !== "string" || query.length > QUERY_MAX_LENGTH || typeof at !== "string") return [];
      const time = Date.parse(at);
      if (!Number.isFinite(time) || (maxAgeMs !== null && now.getTime() - time > maxAgeMs)) return [];
      const canonical = searchQuery(new URLSearchParams(query));
      if (!canonical || seen.has(canonical)) return [];
      seen.add(canonical);
      return [{ query: canonical, at: new Date(time).toISOString() }];
    })
    .slice(0, limit);
}

/** Checks memory from any source (device storage, the account API) field by field. Anything doubtful is dropped. */
export function sanitizeMemory(value: unknown, now = new Date()): AssistantMemory {
  if (!value || typeof value !== "object") return emptyMemory();
  const parsed = value as Partial<Record<keyof AssistantMemory, unknown>>;
  if (parsed.version !== 1 || !Array.isArray(parsed.recent) || !Array.isArray(parsed.preferences)) return emptyMemory();
  const preferences: SearchChip[] = [];
  for (const chip of parsed.preferences.map(preferenceFromId)) {
    if (chip && !preferences.some((existing) => chipId(existing) === chipId(chip))) preferences.push(chip);
  }
  const declined = Array.isArray(parsed.declined)
    ? [...new Set(parsed.declined.filter((id): id is string => typeof id === "string" && preferenceFromId(id) !== null))].slice(0, DECLINED_LIMIT)
    : [];
  return {
    version: 1,
    recent: parseSearches(parsed.recent, now, RECENT_MAX_AGE_MS, RECENT_LIMIT),
    preferences,
    declined,
    saved: parseSearches(parsed.saved, now, null, SAVED_LIMIT),
  };
}

export function parseMemory(raw: string | null, now = new Date()): AssistantMemory {
  if (!raw) return emptyMemory();
  try {
    return sanitizeMemory(JSON.parse(raw), now);
  } catch {
    return emptyMemory();
  }
}

/** The stored form: preferences as chip IDs. */
export function memoryToJson(memory: AssistantMemory) {
  return { ...memory, preferences: memory.preferences.map(chipId) };
}

export function serializeMemory(memory: AssistantMemory): string {
  return JSON.stringify(memoryToJson(memory));
}

function mergeSearches(first: readonly RecentSearch[], second: readonly RecentSearch[], limit: number) {
  const latest = new Map<string, RecentSearch>();
  for (const entry of [...first, ...second]) {
    const existing = latest.get(entry.query);
    if (!existing || Date.parse(entry.at) > Date.parse(existing.at)) latest.set(entry.query, entry);
  }
  return [...latest.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}

/** Moves a guest's device memory into their account's memory. */
export function mergeMemories(account: AssistantMemory, guest: AssistantMemory): AssistantMemory {
  const preferences = [...account.preferences];
  for (const chip of guest.preferences) {
    if (!preferences.some((existing) => chipId(existing) === chipId(chip))) preferences.push(chip);
  }
  const remembered = new Set(preferences.map(chipId));
  return {
    version: 1,
    recent: mergeSearches(account.recent, guest.recent, RECENT_LIMIT),
    preferences,
    declined: [...new Set([...account.declined, ...guest.declined])].filter((id) => !remembered.has(id)).slice(0, DECLINED_LIMIT),
    saved: mergeSearches(account.saved, guest.saved, SAVED_LIMIT),
  };
}

export function recordSearch(memory: AssistantMemory, params: ReadonlyParams, now = new Date()): AssistantMemory {
  const query = searchQuery(params);
  if (!query) return memory;
  const recent = [{ query, at: now.toISOString() }, ...memory.recent.filter((entry) => entry.query !== query)].slice(0, RECENT_LIMIT);
  return { ...memory, recent };
}

export function saveSearch(memory: AssistantMemory, params: ReadonlyParams, now = new Date()): AssistantMemory {
  const query = searchQuery(params);
  if (!query || memory.saved.some((entry) => entry.query === query)) return memory;
  return { ...memory, saved: [{ query, at: now.toISOString() }, ...memory.saved].slice(0, SAVED_LIMIT) };
}

export function unsaveSearch(memory: AssistantMemory, query: string): AssistantMemory {
  return { ...memory, saved: memory.saved.filter((entry) => entry.query !== query) };
}

export function isSaved(memory: AssistantMemory, params: ReadonlyParams) {
  const query = searchQuery(params);
  return Boolean(query) && memory.saved.some((entry) => entry.query === query);
}

/** A need that keeps coming up in recent searches and is in the current one ("Remember that you need NSFAS-approved?"). */
export function preferenceOffer(memory: AssistantMemory, current: ReadonlyParams): SearchChip | null {
  const known = new Set([...memory.preferences.map(chipId), ...memory.declined]);
  for (const chip of chipsFromParams(current)) {
    // Only needs are offered ("NSFAS approved", "Furnished"); a property type reads oddly as one.
    if (chip.kind !== "quick" || (chip.value !== "furnished" && chip.value !== "nsfas-approved")) continue;
    if (known.has(chipId(chip))) continue;
    const id = chipId(chip);
    const count = memory.recent.filter((entry) => chipsFromParams(new URLSearchParams(entry.query)).some((stored) => chipId(stored) === id)).length;
    if (count >= OFFER_AFTER_SEARCHES) return chip;
  }
  return null;
}

export function rememberPreference(memory: AssistantMemory, chip: SearchChip): AssistantMemory {
  if (memory.preferences.some((stored) => chipId(stored) === chipId(chip))) return memory;
  return { ...memory, preferences: [...memory.preferences, chip], declined: memory.declined.filter((id) => id !== chipId(chip)) };
}

export function declinePreference(memory: AssistantMemory, chip: SearchChip): AssistantMemory {
  return { ...memory, declined: [...new Set([...memory.declined, chipId(chip)])].slice(0, DECLINED_LIMIT) };
}

export function forgetPreference(memory: AssistantMemory, id: string): AssistantMemory {
  return { ...memory, preferences: memory.preferences.filter((chip) => chipId(chip) !== id) };
}

export function forgetSearch(memory: AssistantMemory, query: string): AssistantMemory {
  return { ...memory, recent: memory.recent.filter((entry) => entry.query !== query) };
}

export function forgetEverything(): AssistantMemory {
  return emptyMemory();
}

export function loadMemory(): AssistantMemory {
  if (typeof window === "undefined") return emptyMemory();
  try {
    return parseMemory(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyMemory();
  }
}

export function saveMemory(memory: AssistantMemory) {
  try {
    if (isMemoryEmpty(memory)) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, serializeMemory(memory));
  } catch {
    // Memory is a convenience; the assistant works without storage.
  }
}

/** Clears this device's copy once it has moved into the account. */
export function clearDeviceMemory() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** A random ID for this device. It only shares out the guest allowance. */
export function getDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const created = crypto.randomUUID().replaceAll("-", "");
    window.localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID().replaceAll("-", "");
  }
}
