"use client";

import { safeRedirectPath } from "@/lib/redirects";
import { z } from "zod";

const receiptSchema = z.object({
  offerId: z.string().uuid(), version: z.number().int().positive(), pendingRevisionId: z.string().uuid().nullable(),
}).strict();
type Receipt = z.infer<typeof receiptSchema>;
type Result<T> = { ok: true; data: T } | { ok: false; status: number; message: string; nextPath?: string };
const unconfirmed = "Could not confirm this request. Your text is still here. Try again or check the latest version.";
const conflict = "This offer changed. Your text is still here. Load the latest version before editing again.";
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function requestOfferWorkspace(body: unknown, enrollment?: false): Promise<Result<Receipt>>;
export function requestOfferWorkspace(body: unknown, enrollment: true): Promise<Result<{ enrolled: true }>>;

export async function requestOfferWorkspace(body: unknown, enrollment = false) {
  let response: Response;
  try {
    response = await fetch(`/api/private/offers${enrollment ? "/enroll" : ""}`, {
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
    const nextPath = typeof result.nextPath === "string" ? safeRedirectPath(result.nextPath, "/post/offers") : accountPath;
    return { ok: false as const, status: response.status, message, nextPath };
  }
  if (enrollment) return result.enrolled === true
    ? { ok: true as const, data: { enrolled: true as const } }
    : { ok: false as const, status: 503, message: unconfirmed };
  const receipt = receiptSchema.safeParse(result);
  if (!receipt.success) return { ok: false as const, status: 503, message: unconfirmed };
  const input = object(body), saved = receipt.data;
  // A late replay must not merge another session's version into this form's text.
  const sameVersionWithdrawal = input.command === "withdraw" && saved.version === input.expectedVersion && saved.pendingRevisionId === null;
  if (saved.offerId !== input.offerId || (saved.version !== Number(input.expectedVersion) + 1 && !sameVersionWithdrawal)
    || (input.command === "submit" && saved.pendingRevisionId !== input.revisionId)
    || ((input.command === "create" || input.command === "withdraw") && saved.pendingRevisionId !== null))
    return { ok: false as const, status: 409, message: conflict };
  return { ok: true as const, data: saved };
}
