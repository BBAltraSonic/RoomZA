import "server-only";

import { z } from "zod";
import { requireAnyPersona } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createUntypedClient } from "@/lib/supabase/admin";
import { actionFailure, actionSuccess } from "@/lib/action-result";

export type ListingCommand = "publish" | "unpublish" | "archive" | "restore" | "delete" | "duplicate";
export const lifecycleInput = z.object({
  listingId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
});

/** Identity and session are verified here; neither comes from mutation input. */
export async function runListingCommand(
  command: ListingCommand,
  listingId: string,
  expectedUpdatedAt: string,
) {
  const input = lifecycleInput.safeParse({ listingId, expectedUpdatedAt });
  if (!input.success) return actionFailure("Reload the listing before making this change.");
  const { user } = await requireAnyPersona(["landlord", "seller"]);
  const client = await createClient();
  const { data: claims, error: claimsError } = await client.auth.getClaims();
  const session = z.string().uuid().safeParse(claims?.claims.session_id);
  if (claimsError || claims?.claims.sub !== user.id || !session.success) {
    return actionFailure("Sign in again before changing this listing.");
  }
  const { data, error } = await createUntypedClient().rpc("pinpoint_property_lifecycle", {
    actor_id: user.id,
    actor_session_id: session.data,
    target: listingId,
    expected_updated_at: expectedUpdatedAt,
    command,
  });
  if (error) {
    return actionFailure(error.code === "PT409"
      ? "This listing changed. Reload it before trying again."
      : error.code === "PT422"
        ? "This change is unavailable for the listing's current state. Listings with active applications must be archived."
        : "Listing not found or access denied.");
  }
  const result = z.object({ listingId: z.string().uuid(), updatedAt: z.string().datetime({ offset: true }) }).safeParse(data);
  if (!result.success || (command !== "duplicate" && result.data.listingId !== listingId)) {
    return actionFailure("Unable to confirm this change. Reload the listing.");
  }
  return actionSuccess(result.data);
}
