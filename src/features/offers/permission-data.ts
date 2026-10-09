import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { OfferIntakeDatabase } from "./intake";
import { offerWriteRequestSchema, type OfferWriteRequest } from "./workspace-contract";

type PermissionDatabase = Omit<OfferIntakeDatabase, "public"> & {
  public: Omit<OfferIntakeDatabase["public"], "Functions"> & {
    Functions: OfferIntakeDatabase["public"]["Functions"] & {
      pinpoint_offer_submit_permission: {
        Args: { target: string; revision: string; expected_version: number; permission_confirmed: boolean; permission_version: string };
        Returns: Json;
      };
    };
  };
};

export async function submitPermissionedOffer(input: Extract<OfferWriteRequest, { command: "submit" }>) {
  await requireUser({ redirectTo: "/post/offers" });
  const parsed = offerWriteRequestSchema.parse(input);
  if (parsed.command !== "submit") throw new Error("Submission required");
  const client = await createClient() as unknown as SupabaseClient<PermissionDatabase>;
  const { data, error } = await client.rpc("pinpoint_offer_submit_permission", {
    target: parsed.offerId, revision: parsed.revisionId, expected_version: parsed.expectedVersion,
    permission_confirmed: parsed.permissionConfirmed, permission_version: parsed.permissionVersion,
  });
  if (error) throw error;
  return z.object({ offerId: z.string().uuid(), version: z.number().int().positive(), pendingRevisionId: z.string().uuid().nullable() }).strict().parse(data);
}
