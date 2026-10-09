import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/features/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { EntryIntakeDatabase } from "./intake";
import { entryIntakeResultSchema } from "./intake-contract";
import { rejectEntrySubmission } from "./intake";
import { entryDecisionSchema, entryPermissionCommandSchema, entryPermissionResultSchema, entryPublicationStateSchema, entryReviewQueueSchema } from "./publication-contract";
import { z } from "zod";
import { entryCategorySchema, type EntryCategory } from "./schema";

type PublicationDatabase = Omit<EntryIntakeDatabase,"public"> & { public: Omit<EntryIntakeDatabase["public"],"Functions"> & {
  Functions: EntryIntakeDatabase["public"]["Functions"] & {
    pinpoint_entry_confirm_permission: { Args: { category: EntryCategory; target: string; revision: string; expected_version: number }; Returns: Json };
    pinpoint_entry_review_queue: { Args: Record<string,never>; Returns: Json };
    pinpoint_entry_approve: { Args: { category: EntryCategory; target: string; revision: string; expected_version: number; authority_notes: string; location_notes: string; media_state: string }; Returns: Json };
    pinpoint_entry_unpublish: { Args: { category: EntryCategory; target: string; expected_version: number; reason: string }; Returns: Json };
    pinpoint_entry_owner_publication: { Args: { category: EntryCategory; target: string }; Returns: Json };
  };
} };
async function session() { return await createClient() as unknown as SupabaseClient<PublicationDatabase>; }
export async function confirmEntryPermission(input: unknown) {
  await requireUser({ redirectTo: "/post/entries" });
  const command=entryPermissionCommandSchema.parse(input), client=await session();
  const { data,error }=await client.rpc("pinpoint_entry_confirm_permission",{category:command.category,target:command.entryId,revision:command.revisionId,expected_version:command.expectedVersion});
  if(error) throw error;
  const result=entryPermissionResultSchema.parse(data);
  if(result.entryId!==command.entryId||result.category!==command.category||result.revisionId!==command.revisionId||result.version!==command.expectedVersion) throw new Error("Entry permission response mismatch");
  return result;
}
export async function readEntryReviewQueue() {
  await requireAdmin({redirectTo:"/admin/entries"});
  const {data,error}=await (await session()).rpc("pinpoint_entry_review_queue",{});
  if(error) throw error;
  return entryReviewQueueSchema.parse(data);
}
export async function decideEntry(input: unknown) {
  await requireAdmin({redirectTo:"/admin/entries"});
  const command=entryDecisionSchema.parse(input);
  if(command.decision==="reject") return rejectEntrySubmission({category:command.category,entryId:command.entryId,revisionId:command.revisionId,expectedVersion:command.expectedVersion,reason:command.reason});
  const client=await session();
  const {data,error}=command.decision==="approve"
    ?await client.rpc("pinpoint_entry_approve",{category:command.category,target:command.entryId,revision:command.revisionId,expected_version:command.expectedVersion,authority_notes:command.authorityNotes,location_notes:command.locationNotes,media_state:command.mediaState})
    :await client.rpc("pinpoint_entry_unpublish",{category:command.category,target:command.entryId,expected_version:command.expectedVersion,reason:command.reason});
  if(error) throw error;
  const result=entryIntakeResultSchema.parse(data);
  if(result.entryId!==command.entryId||result.category!==command.category||result.version!==command.expectedVersion+1||(command.decision==="approve"&&result.pendingRevisionId!==null)) throw new Error("Entry decision response mismatch");
  return result;
}
export async function readOwnedEntryPublication(category: EntryCategory, entryId: string) {
  await requireUser({redirectTo:`/post/entries/${category}/${entryId}`});
  const {data,error}=await(await session()).rpc("pinpoint_entry_owner_publication",{category:entryCategorySchema.parse(category),target:z.string().uuid().parse(entryId)});
  if(error) throw error;
  return entryPublicationStateSchema.parse(data);
}
