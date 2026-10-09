import "server-only";

import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/features/admin/auth";
import { safeRedirectPath } from "@/lib/redirects";
import { rejectOfferSubmission } from "./intake";
import { offerRejectionRequestSchema } from "./review-contract";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function handleOfferReviewRejection(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "This request must come from this site." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Send a JSON request." }, 415);
  try {
    await requireUser({ redirectTo: "/admin/offers" });
    await requireAdmin({ redirectTo: "/admin/offers" });
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 12000) return json({ error: "Correction is too long." }, 413);
    let input: unknown;
    try { input = JSON.parse(body); } catch { return json({ error: "Invalid request." }, 400); }
    return json(await rejectOfferSubmission(offerRejectionRequestSchema.parse(input)));
  } catch (error) {
    if (isRedirectError(error)) {
      const nextPath = safeRedirectPath(getURLFromRedirectError(error), "/admin/offers");
      return json({ error: "Admin access and verified MFA are required before continuing.", nextPath }, nextPath.startsWith("/auth?") ? 401 : 403);
    }
    if (error instanceof z.ZodError) return json({ error: "Add a correction reason and reload the submitted version if necessary." }, 400);
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "PT409") return json({ error: "This offer changed. Your correction text is still here. Load the current submission before reviewing again." }, 409);
    if (code === "42501") return json({ error: "Reviewer or poster access is no longer available." }, 403);
    if (code === "22023") return json({ error: "This revision is no longer awaiting review, or its correction reason is invalid." }, 400);
    return json({ error: "Could not record the correction. Your text is still here. Check the latest submission before retrying." }, 500);
  }
}
