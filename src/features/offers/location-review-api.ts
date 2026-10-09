import "server-only";

import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/features/admin/auth";
import { safeRedirectPath } from "@/lib/redirects";
import { locationEvidenceRequestSchema } from "./location-review-contract";
import { recordOfferLocationEvidence } from "./location-review-data";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function handleOfferLocationEvidence(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "This request must come from this site." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Send a JSON request." }, 415);
  try {
    await requireUser({ redirectTo: "/admin/offers" });
    await requireAdmin({ redirectTo: "/admin/offers" });
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 24000) return json({ error: "Review evidence is too long." }, 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { return json({ error: "Invalid request." }, 400); }
    return json(await recordOfferLocationEvidence(locationEvidenceRequestSchema.parse(body)));
  } catch (error) {
    if (isRedirectError(error)) {
      const nextPath = safeRedirectPath(getURLFromRedirectError(error), "/admin/offers");
      return json({ error: "Admin access and verified MFA are required before continuing.", nextPath }, nextPath.startsWith("/auth?") ? 401 : 403);
    }
    if (error instanceof z.ZodError) return json({ error: "Add the place and shop source references, verification note and all four confirmations." }, 400);
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "PT409") return json({ error: "The offer or stored place changed. Your evidence text is still here. Load the current review before continuing." }, 409);
    if (code === "42501") return json({ error: "Reviewer or poster access is no longer available." }, 403);
    if (code === "22023") return json({ error: "Current authorization, place, shop and date evidence is required. Load the current review before retrying." }, 400);
    return json({ error: "Could not record this review. Your text is still here. Load the current review before retrying." }, 500);
  }
}
