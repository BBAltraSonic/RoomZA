import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createUntypedClient } from "@/lib/supabase/admin";
import { actionFailure, actionSuccess } from "@/lib/action-result";
import { PURCHASE_STAGES, type PurchaseStage } from "./progress";
const stageSchema = z.enum(PURCHASE_STAGES as [PurchaseStage, ...PurchaseStage[]]);
export async function savePurchaseStage(client: SupabaseClient, listingId: string, stage: PurchaseStage) {
  if (!z.string().uuid().safeParse(listingId).success || !stageSchema.safeParse(stage).success) return actionFailure("Invalid purchase progress.");
  const claims = await client.auth.getClaims();
  const identity = z.object({ sub: z.string().uuid(), session_id: z.string().uuid() }).safeParse(claims.data?.claims);
  if (claims.error || !identity.success) return actionFailure("Sign in again to update purchase progress.");
  const { data, error } = await createUntypedClient().rpc("pinpoint_purchase_progress", {
    actor_id: identity.data.sub, actor_session_id: identity.data.session_id, target: listingId, next_stage: stage,
  });
  if(error) return actionFailure("Unable to update purchase progress.");
  const result = z.object({ currentStage: stageSchema, completedStages: z.array(stageSchema) }).safeParse(data);
  return result.success ? actionSuccess(result.data) : actionFailure("Unable to confirm purchase progress.");
}
