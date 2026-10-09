"use client";

import { safeRedirectPath } from "@/lib/redirects";
import type { EntryIntakeCommand } from "./intake-contract";

type WriteResult = { entryId: string; category: "tourism" | "event"; version: number; pendingRevisionId: string | null };
type EnrollmentResult = { enrolled: true; category: "tourism" | "event" };
type Failure = { ok: false; status: number; message: string; nextPath?: string };

export function requestEntryWorkspace(body: EntryIntakeCommand): Promise<{ ok: true; data: WriteResult } | Failure>;
export function requestEntryWorkspace(body: { category: "tourism" | "event" }, enrollment: true): Promise<{ ok: true; data: EnrollmentResult } | Failure>;
export async function requestEntryWorkspace(body: EntryIntakeCommand | { category: "tourism" | "event" }, enrollment = false) {
  const response = await fetch(`/api/private/entries${enrollment ? "/enroll" : ""}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = result.error;
    const message = typeof error === "string" ? error : typeof error?.message === "string" ? error.message : "Could not complete this request. Your text is still here.";
    const accountPath = error?.code === "account_suspended" ? "/account-suspended"
      : response.status === 401 ? `/auth?redirect=${encodeURIComponent(window.location.pathname)}` : undefined;
    const nextPath = typeof result.nextPath === "string" ? safeRedirectPath(result.nextPath, "/post/entries") : accountPath;
    return { ok: false as const, status: response.status, message, nextPath };
  }
  return { ok: true as const, data: result as WriteResult | EnrollmentResult };
}
