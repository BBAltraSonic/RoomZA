import { z } from "zod";

import { nextVersion, type PikoLineKey } from "@/features/piko/lines";

import { GAP_KEYS } from "./search-intent";

/**
 * The assistant's conversation (proposal, "Chat design"). It lasts for this visit only: it lives
 * in this tab's session storage and is gone when the tab closes. Memory across visits stays as
 * chips (memory.ts), never this thread. Everything Pinpoint says in it is a fixed sentence
 * picked by key or a card built from data; nothing in it is written by the AI.
 */

export const MAX_THREAD_ENTRIES = 40;
const STORAGE_PREFIX = "pinpoint:assistant-thread:v1:";

/** Piko's notes for things that aren't a search or a card. Their words live in PIKO_LINES. */
export const NOTE_KEYS = ["english_only", "allowance_used", "busy", "ai_unavailable", "not_understood"] as const satisfies readonly PikoLineKey[];
export type NoteKey = (typeof NOTE_KEYS)[number];

/** Which of a key's lines was shown, kept so a reload shows the same one. */
const version = z.number().int().min(0).max(9).optional();

const text = z.string().trim().min(1).max(300);
const gapSchema = z.object({ key: z.enum(GAP_KEYS), label: z.string().max(80) });
const factListingSchema = z.object({ id: z.string().min(1), title: z.string().max(200), listing_type: z.enum(["rent", "sale"]).optional() });
const factAnswerSchema = z.discriminatedUnion("known", [
  z.object({ known: z.literal(true), answer: z.string().max(400) }),
  z.object({ known: z.literal(false) }),
]);

const itemSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200),
  kind: z.enum(["special", "event", "place", "service"]),
  by: z.string().max(200),
});

const entrySchema = z.discriminatedUnion("kind", [
  z.object({ id: z.string(), from: z.literal("person"), kind: z.literal("message"), text }),
  // What was searched, as chip labels. Static history: the live chips are pinned at the top.
  z.object({ id: z.string(), from: z.literal("pinpoint"), kind: z.literal("search"), chips: z.array(z.string().max(80)).max(20), gaps: z.array(gapSchema).max(12), v: version }),
  z.object({ id: z.string(), from: z.literal("pinpoint"), kind: z.literal("note"), note: z.enum(NOTE_KEYS), v: version }),
  z.object({ id: z.string(), from: z.literal("pinpoint"), kind: z.literal("fact"), listing: factListingSchema, question: text, answer: factAnswerSchema }),
  // An answer about one special, event, place or service, read from its own fields.
  z.object({ id: z.string(), from: z.literal("pinpoint"), kind: z.literal("item_fact"), item: itemSchema, question: text, answer: factAnswerSchema }),
  z.object({ id: z.string(), from: z.literal("pinpoint"), kind: z.literal("compare"), ids: z.array(z.string().min(1)).min(2).max(3), mode: z.enum(["rent", "buy"]) }),
]);
const storedSchema = z.object({ version: z.literal(1), entries: z.array(entrySchema).max(MAX_THREAD_ENTRIES) });

export type ThreadEntry = z.infer<typeof entrySchema>;
/** A new entry before it has an id. A person's message may leave out its kind. */
export type NewThreadEntry =
  | { from: "person"; text: string }
  | (ThreadEntry extends infer Entry ? (Entry extends { from: "pinpoint" } ? Omit<Entry, "id"> : never) : never);

type ThreadStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

let counter = 0;
function newId() {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Adds entries to the end and keeps the latest MAX_THREAD_ENTRIES. */
export function appendToThread(thread: readonly ThreadEntry[], ...entries: NewThreadEntry[]): ThreadEntry[] {
  const next = [...thread];
  for (const entry of entries) {
    if (entry.from === "person") {
      next.push({ id: newId(), from: "person", kind: "message", text: entry.text });
      continue;
    }
    const key = lineKey(entry);
    const withVersion = key ? { ...entry, v: nextVersion(key, lastVersion(next, key)) } : entry;
    next.push({ ...withVersion, id: newId() } as ThreadEntry);
  }
  return next.slice(-MAX_THREAD_ENTRIES);
}

/** The Piko line an entry speaks, if it speaks one. */
function lineKey(entry: { kind: string; note?: NoteKey }): PikoLineKey | null {
  if (entry.kind === "search") return "searching";
  if (entry.kind === "note" && entry.note) return entry.note;
  return null;
}

function lastVersion(thread: readonly ThreadEntry[], key: PikoLineKey): number | undefined {
  for (let index = thread.length - 1; index >= 0; index -= 1) {
    const entry = thread[index];
    if (entry && (entry.kind === "search" || entry.kind === "note") && lineKey(entry) === key) return entry.v ?? 0;
  }
  return undefined;
}

export function threadStorageKey(scope: string) {
  return `${STORAGE_PREFIX}${scope}`;
}

function sessionStore(): ThreadStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Reads this visit's thread. A missing, malformed or tampered one reads as empty. */
export function loadThread(scope: string, storage: ThreadStorage | null = sessionStore()): ThreadEntry[] {
  try {
    const raw = storage?.getItem(threadStorageKey(scope));
    if (!raw) return [];
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.entries : [];
  } catch {
    return [];
  }
}

export function saveThread(scope: string, thread: readonly ThreadEntry[], storage: ThreadStorage | null = sessionStore()) {
  try {
    if (!thread.length) storage?.removeItem(threadStorageKey(scope));
    else storage?.setItem(threadStorageKey(scope), JSON.stringify({ version: 1, entries: thread.slice(-MAX_THREAD_ENTRIES) }));
  } catch {
    // Private mode or a full store: the chat still works, it just isn't kept for the visit.
  }
}

export function clearThread(scope: string, storage: ThreadStorage | null = sessionStore()) {
  try {
    storage?.removeItem(threadStorageKey(scope));
  } catch {
    // Nothing to clear.
  }
}
