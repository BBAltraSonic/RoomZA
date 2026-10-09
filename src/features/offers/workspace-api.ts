import "server-only";

import { z } from "zod";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { requireUser } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/redirects";
import { enrollOfferPoster, writeOfferIntake } from "./intake";
import { offerWriteRequestSchema } from "./workspace-contract";
import { submitPermissionedOffer } from "./permission-data";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function handleOfferWorkspaceWrite(request: Request, enrollment = false) {
  // Cookie-authenticated mutations need an explicit same-origin JSON request.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return json({ error: "This request must come from this site.", code: "forbidden" }, 403);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "Send a JSON request.", code: "invalid_request" }, 415);
  }
  try {
    await requireUser({ redirectTo: "/post/offers" });
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 20000) return json({ error: "Offer is too long.", code: "invalid_request" }, 413);
    let input: unknown;
    try { input = JSON.parse(body); } catch { return json({ error: "Invalid request.", code: "invalid_request" }, 400); }
    if (enrollment) {
      z.object({}).strict().parse(input);
      await enrollOfferPoster();
      return json({ enrolled: true });
    }
    const parsed = offerWriteRequestSchema.parse(input);
    return json(await (parsed.command === "submit" ? submitPermissionedOffer(parsed) : writeOfferIntake(parsed)));
  } catch (error) {
    if (isRedirectError(error)) {
      const nextPath = safeRedirectPath(getURLFromRedirectError(error), "/post/offers");
      return json({ error: "Your account needs attention before you can continue.", code: "account_gate", nextPath }, nextPath.startsWith("/auth?") ? 401 : 403);
    }
    if (error instanceof z.ZodError) return json({ error: "Check the offer fields and try again.", code: "validation_failed" }, 400);
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "PT409") return json({ error: "This offer changed in another session. Your unsaved text is still here. Load the latest version before editing again.", code: "conflict" }, 409);
    if (code === "42501") return json({ error: "Poster access is unavailable for this account or offer.", code: "forbidden" }, 403);
    if (code === "22023" || code === "22007" || code === "22008") return json({ error: "Check the required fields, dates and shop point within the selected place. Save before submitting; only one revision can await review.", code: "validation_failed" }, 400);
    return json({ error: "Could not complete this request. Your text is still here. Check the latest version before retrying.", code: "server_error" }, 500);
  }
}
