"use client";

import { safeRedirectPath } from "@/lib/redirects";
import { entryIntakeResultSchema, type EntryIntakeCommand } from "./intake-contract";

type WriteResult = { entryId: string; category: "tourism" | "event"; version: number; pendingRevisionId: string | null };
type EnrollmentResult = { enrolled: true; category: "tourism" | "event" };
type Failure = { ok: false; status: number; message: string; nextPath?: string };
const unconfirmed = "Could not confirm this request. Your text is still here. Try again or check the latest version.";
const conflict = "This entry changed. Your text is still here. Load the latest version before editing again.";
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function requestEntryWorkspace(body: EntryIntakeCommand): Promise<{ ok: true; data: WriteResult } | Failure>;
export function requestEntryWorkspace(body: { category: "tourism" | "event" }, enrollment: true): Promise<{ ok: true; data: EnrollmentResult } | Failure>;
export async function requestEntryWorkspace(body: EntryIntakeCommand | { category: "tourism" | "event" }, enrollment = false) {
  let response: Response;
  try {
    response = await fetch(`/api/private/entries${enrollment ? "/enroll" : ""}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  } catch { return { ok: false as const, status: 503, message: unconfirmed }; }
  const result = object(await response.json().catch(() => null));
  if (!response.ok) {
    const error = result.error;
    const details = object(error);
    const message = typeof error === "string" ? error : typeof details.message === "string" ? details.message : unconfirmed;
    const accountPath = details.code === "account_suspended" ? "/account-suspended"
      : response.status === 401 ? `/auth?redirect=${encodeURIComponent(window.location.pathname)}` : undefined;
    const nextPath = typeof result.nextPath === "string" ? safeRedirectPath(result.nextPath, "/post/entries") : accountPath;
    return { ok: false as const, status: response.status, message, nextPath };
  }
  if (enrollment) return result.enrolled === true && result.category === body.category
    ? { ok: true as const, data: { enrolled: true as const, category: body.category } }
    : { ok: false as const, status: 503, message: unconfirmed };
  const receipt = entryIntakeResultSchema.safeParse(result);
  if (!receipt.success || !("command" in body)) return { ok: false as const, status: 503, message: unconfirmed };
  const saved = receipt.data;
  const currentWithdrawal = body.command === "withdraw" && saved.version === body.expectedVersion && saved.pendingRevisionId === null;
  // Only acknowledge this command's receipt; a stale response must not replace retained form state.
  if (saved.entryId !== body.entryId || saved.category !== body.category
    || (saved.version !== body.expectedVersion + 1 && !currentWithdrawal)
    || (body.command === "submit" && saved.pendingRevisionId !== body.revisionId)
    || ((body.command === "create" || body.command === "withdraw") && saved.pendingRevisionId !== null))
    return { ok: false as const, status: 409, message: conflict };
  return { ok: true as const, data: saved };
}
