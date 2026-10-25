import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export class ImportRollbackError extends Error {
  constructor(message: string, readonly status: 500 | 503 = 500) {
    super(message);
    this.name = "ImportRollbackError";
  }
}

type RollbackResult = {
  id: string;
  listingId: string;
  status: "pending" | "done" | "conflict" | "legacy_unverified";
  receipt?: { cleanupPaths: string[]; databaseApplied: boolean };
};

type RollbackSummary = {
  restored: number;
  deletedDrafts: number;
  conflicts: number;
  pending: number;
  completed: number;
  messageCode: string;
};

export async function rollbackListingImport(
  admin: SupabaseClient,
  job: { id: string; organization_id: string; created_by: string; stage: string },
  actorId: string,
) {
  if (job.stage !== "complete") throw new Error("Only a completed import can be rolled back.");
  const argumentsForJob = { target_job_id: job.id, rollback_actor_id: actorId };
  async function summarize() {
    const { data, error } = await admin.rpc("finish_listing_import_rollback", argumentsForJob);
    if (error || !data || typeof data.pending !== "number") {
      throw new ImportRollbackError("Rollback could not be confirmed. Retry to check its saved progress.");
    }
    return data as RollbackSummary;
  }

  try {
    // Including acknowledged rows keeps offsets stable during concurrent/repeated requests.
    const snapshotIds: string[] = [];
    for (let from = 0; ; from += 1_000) {
      const { data, error } = await admin.from("listing_import_change_snapshots")
        .select("id").eq("job_id", job.id)
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(from, from + 999);
      if (error) throw new ImportRollbackError("Rollback history is unavailable. Retry to continue.");
      snapshotIds.push(...(data ?? []).map((snapshot) => snapshot.id as string));
      if ((data?.length ?? 0) < 1_000) break;
    }

    for (let from = 0; from < snapshotIds.length; from += 50) {
      const targetIds = snapshotIds.slice(from, from + 50);
      const { data, error } = await admin.rpc("prepare_listing_import_rollback_batch", {
        ...argumentsForJob, target_snapshot_ids: targetIds,
      });
      if (error || !Array.isArray(data) || data.length !== targetIds.length) {
        throw new ImportRollbackError("Rollback was interrupted. Your progress is saved. Retry to finish.");
      }
      const pendingIds: string[] = [];
      const cleanupPaths = new Set<string>();
      for (const result of data as RollbackResult[]) {
        if (!targetIds.includes(result.id)
          || !["pending", "done", "conflict", "legacy_unverified"].includes(result.status)) {
          throw new ImportRollbackError("Rollback could not be confirmed. Retry to check its saved progress.");
        }
        if (result.status !== "pending") continue;
        if (!result.receipt?.databaseApplied || !Array.isArray(result.receipt.cleanupPaths)) {
          throw new ImportRollbackError("Rollback could not be confirmed. Retry to check its saved progress.");
        }
        const prefix = `organizations/${job.organization_id}/${result.listingId}/`;
        for (const path of result.receipt.cleanupPaths) {
          if (typeof path !== "string" || !path.startsWith(prefix)
            || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/.test(path.slice(prefix.length))) {
            throw new ImportRollbackError("Some image changes need manual review. Your saved history is retained.");
          }
          cleanupPaths.add(path);
        }
        pendingIds.push(result.id);
      }

      const paths = [...cleanupPaths];
      for (let offset = 0; offset < paths.length; offset += 1_000) {
        const candidates = paths.slice(offset, offset + 1_000);
        const referenced = new Set<string>();
        // Duplicated drafts share objects. Keep any object still used by a listing.
        // Short query groups avoid oversized URLs; keyset pages cover >1000 references.
        for (let start = 0; start < candidates.length; start += 25) {
          const group = candidates.slice(start, start + 25);
          let lastId: string | undefined;
          for (;;) {
            let query = admin.from("listing_images").select("id,path")
              .eq("bucket", "listing-images").in("path", group)
              .order("id", { ascending: true }).limit(1_000);
            if (lastId) query = query.gt("id", lastId);
            const { data: references, error: referenceError } = await query;
            if (referenceError || !references) {
              throw new ImportRollbackError("Photo cleanup could not be checked. Your progress is saved. Retry to finish.");
            }
            for (const reference of references) referenced.add(reference.path as string);
            if (!references.length || group.every((path) => referenced.has(path))) break;
            lastId = references[references.length - 1]!.id as string;
          }
        }
        const removable = candidates.filter((path) => !referenced.has(path));
        if (!removable.length) continue;
        const { error: removeError } = await admin.storage.from("listing-images").remove(removable);
        if (removeError) {
          throw new ImportRollbackError("Some images could not be removed. Your rollback progress is saved. Retry to finish cleanup.", 503);
        }
      }
      if (pendingIds.length) {
        const { error: acknowledgeError } = await admin.rpc("acknowledge_listing_import_rollback_batch", {
          ...argumentsForJob, target_snapshot_ids: pendingIds,
        });
        if (acknowledgeError) {
          throw new ImportRollbackError("Rollback could not be confirmed. Your progress is saved. Retry to finish.");
        }
      }
    }

    const result = await summarize();
    if (result.pending) throw new ImportRollbackError("Some changes still need rollback or cleanup. Retry to continue from saved progress.");
    return result;
  } catch (error) {
    // Summarization reads durable receipts, so retry cannot double-count a write.
    try { await summarize(); } catch { /* Keep the original failure if the database is unavailable. */ }
    if (error instanceof ImportRollbackError) throw error;
    throw new ImportRollbackError("Rollback was interrupted. Retry to continue from saved progress.");
  }
}
