import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { matchImages } from "./image-matching";
import { applyImportAssetReview, ImportAssetReviewError } from "./asset-review";
import type { CanonicalImportListing } from "./types";

type AssetRow = {
  id: string;
  source_name: string | null;
  storage_path: string | null;
  mime_type: string | null;
  sort_order: number | null;
  is_cover: boolean;
};

export async function reconcileImportRowImages(admin: SupabaseClient, jobId: string, rowId: string) {
  await applyImportAssetReview(admin, jobId, { action: "reconcile", rowId });
}

async function readMatchingPages<T>(read: (last: T | undefined) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const records: T[] = [];
  while (true) {
    const { data, error } = await read(records.at(-1));
    if (error) throw new ImportAssetReviewError(500, "Unable to load saved image matching data. Reload before retrying.");
    if (!data?.length) return records;
    records.push(...data);
    if (data.length < 1_000) return records;
  }
}

type MatchingRow = { id: string; row_number: number; normalized_data: CanonicalImportListing };
type MatchingAsset = { id: string; source_name: string | null };

export async function rematchImportAssets(admin: SupabaseClient, jobId: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const assets = await readMatchingPages<MatchingAsset>((last) => {
      let query = admin.from("listing_import_assets").select("id, source_name")
        .eq("job_id", jobId).is("row_id", null).in("state", ["uploaded", "unmatched"]).order("id").limit(1_000);
      if (last) query = query.gt("id", last.id);
      return query;
    });
    if (!assets.length) return;
    const rows = await readMatchingPages<MatchingRow>((last) => {
      let query = admin.from("listing_import_rows").select("id, row_number, normalized_data")
        .eq("job_id", jobId).not("state", "in", "(removed,skipped,committed,published)").is("resulting_listing_id", null)
        .order("row_number").limit(1_000);
      if (last) query = query.gt("row_number", last.row_number);
      return query;
    });
    const candidates = assets.map((asset) => {
      const parts = asset.source_name?.replaceAll("\\", "/").split("/") ?? [];
      return { id: asset.id, filename: parts.at(-1), sourceReferenceFolder: parts.length > 1 ? parts.at(-2) : undefined };
    });
    const plans = rows.map((row) => ({ row, result: matchImages({ explicit: row.normalized_data.imageReferences ?? [], sourceReference: row.normalized_data.sourceReference }, candidates) }));
    const priority = { explicit: 0, source_reference: 1, prefix: 2 };
    const claims = new Map<string, Array<{ rowId: string; rank: number }>>();
    for (const plan of plans) for (const asset of plan.result.matched) {
      const current = claims.get(asset.id) ?? [];
      current.push({ rowId: plan.row.id, rank: priority[asset.method] });
      claims.set(asset.id, current);
    }
    let stale = false;
    for (const { row, result } of plans) {
      const matches = result.matched.filter((asset) => {
        const owners = claims.get(asset.id)!;
        const best = Math.min(...owners.map((owner) => owner.rank));
        const eligible = owners.filter((owner) => owner.rank === best);
        return eligible.length === 1 && eligible[0]!.rowId === row.id;
      }).slice(0, 20).map((asset) => ({ assetId: asset.id, method: asset.method }));
      if (!matches.length) continue;
      const receipt = await applyImportAssetReview(admin, jobId, {
        action: "match", rowId: row.id,
        hints: { sourceReference: row.normalized_data.sourceReference ?? null, imageReferences: row.normalized_data.imageReferences ?? [] },
        matches,
      });
      stale ||= receipt.stale;
    }
    if (!stale) return;
  }
  throw new ImportAssetReviewError(409, "Image matching changed while it was being reviewed. Reload before retrying.");
}

export async function attachImportAssets(
  admin: SupabaseClient,
  job: { id: string; organization_id: string },
  rowId: string,
  listingId: string,
  mode: "create" | "replace" | "merge",
) {
  const { data } = await admin.from("listing_import_assets")
    .select("id, source_name, storage_path, mime_type, sort_order, is_cover")
    .eq("job_id", job.id)
    .eq("row_id", rowId)
    .in("state", ["matched", "uploaded"])
    .order("is_cover", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(20);
  const assets = (data ?? []) as AssetRow[];
  if (!assets.length) return 0;

  const { data: currentImages } = await admin.from("listing_images")
    .select("id, path, sort_order")
    .eq("listing_id", listingId)
    .order("sort_order");
  if (mode === "replace" && currentImages?.length) {
    await admin.from("listing_images").delete().eq("listing_id", listingId);
  }
  let nextOrder = mode === "merge" ? (currentImages?.length ?? 0) : 0;
  let attached = 0;
  for (const asset of assets.slice(0, Math.max(0, 20 - nextOrder))) {
    if (!asset.storage_path) continue;
    const { data: blob, error: downloadError } = await admin.storage.from("listing-imports").download(asset.storage_path);
    if (downloadError || !blob) continue;
    const extension = asset.mime_type === "image/png" ? "png" : asset.mime_type === "image/webp" ? "webp" : "jpg";
    const path = `organizations/${job.organization_id}/${listingId}/${crypto.randomUUID()}.${extension}`;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { error: uploadError } = await admin.storage.from("listing-images").upload(path, bytes, {
      contentType: asset.mime_type ?? "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) continue;
    const { data: publicData } = admin.storage.from("listing-images").getPublicUrl(path, {
      transform: { width: 1_600, height: 1_200, resize: "contain", quality: 85 },
    });
    const order = nextOrder;
    nextOrder += 1;
    const { error: imageError } = await admin.from("listing_images").insert({
      listing_id: listingId,
      bucket: "listing-images",
      path,
      public_url: publicData.publicUrl,
      sort_order: order,
    });
    if (imageError) {
      await admin.storage.from("listing-images").remove([path]);
      continue;
    }
    await admin.from("listing_import_assets").update({ state: "attached", sort_order: order }).eq("id", asset.id);
    attached += 1;
  }
  return attached;
}
