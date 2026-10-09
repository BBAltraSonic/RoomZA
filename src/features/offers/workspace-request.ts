"use client";

import { safeRedirectPath } from "@/lib/redirects";

export async function requestOfferWorkspace(body: unknown, enrollment = false) {
  const response = await fetch(`/api/private/offers${enrollment ? "/enroll" : ""}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = result.error;
    const message = typeof error === "string" ? error : typeof error?.message === "string" ? error.message : "Could not complete this request. Your text is still here.";
    const accountPath = error?.code === "account_suspended" ? "/account-suspended"
      : response.status === 401 ? `/auth?redirect=${encodeURIComponent(window.location.pathname)}` : undefined;
    const nextPath = typeof result.nextPath === "string" ? safeRedirectPath(result.nextPath, "/post/offers") : accountPath;
    return { ok: false as const, status: response.status, message, nextPath };
  }
  return { ok: true as const, data: result as { offerId: string; version: number; pendingRevisionId: string | null } };
}
