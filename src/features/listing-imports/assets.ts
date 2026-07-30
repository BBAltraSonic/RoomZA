import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { matchImages } from "./image-matching";
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
  const [{ count }, { data: row }] = await Promise.all([
    admin.from("listing_import_assets")
      .select("id", { head: true, count: "exact" })
      .eq("job_id", jobId)
      .eq("row_id", rowId)
      .in("state", ["matched", "uploaded", "attached"]),
    admin.from("listing_import_rows").select("organization_id, duplicate_candidate_ids").eq("id", rowId).eq("job_id", jobId).maybeSingle(),
  ]);
  if (!row) return;
  if ((count ?? 0) >= 3) {
    await admin.from("listing_import_issues").delete().eq("row_id", rowId).eq("code", "missing_images");
  } else {
    const { count: existing } = await admin.from("listing_import_issues")
      .select("id", { head: true, count: "exact" })
      .eq("row_id", rowId)
      .eq("code", "missing_images")
      .is("resolved_at", null);
    if (!existing) {
      await admin.from("listing_import_issues").insert({
        job_id: jobId,
        organization_id: row.organization_id,
        row_id: rowId,
        severity: "publish_blocker",
        code: "missing_images",
        field: "imageReferences",
        message: "Add at least three matched images before publishing.",
      });
    }
  }
  const { data: remaining } = await admin
    .from("listing_import_issues")
    .select("severity")
    .eq("row_id", rowId)
    .is("resolved_at", null);
  const severities = new Set((remaining ?? []).map((issue) => issue.severity));
  const state = row?.duplicate_candidate_ids?.length
    ? "duplicate_review"
    : severities.has("blocking")
      ? "parse_blocked"
      : severities.has("publish_blocker")
        ? "publish_blocked"
        : severities.has("warning")
          ? "warning"
          : "draft_ready";
  await admin.from("listing_import_rows").update({ state }).eq("id", rowId).eq("job_id", jobId);
}

export async function rematchImportAssets(admin: SupabaseClient, jobId: string) {
  const [{ data: rows }, { data: assets }] = await Promise.all([
    admin.from("listing_import_rows").select("id, normalized_data").eq("job_id", jobId).order("row_number"),
    admin.from("listing_import_assets").select("id, source_name, storage_path").eq("job_id", jobId).is("row_id", null).in("state", ["uploaded", "unmatched"]),
  ]);
  if (!rows?.length || !assets?.length) return;
  const candidates = assets.map((asset) => {
    const sourceName = asset.source_name as string | null;
    const parts = sourceName?.replaceAll("\\", "/").split("/") ?? [];
    return {
      id: asset.id as string,
      filename: parts.at(-1),
      sourceReferenceFolder: parts.length > 1 ? parts.at(-2) : undefined,
    };
  });
  for (const row of rows) {
    const listing = row.normalized_data as CanonicalImportListing;
    const result = matchImages({
      explicit: listing.imageReferences ?? [],
      sourceReference: listing.sourceReference,
    }, candidates);
    for (const [index, asset] of result.matched.slice(0, 20).entries()) {
      await admin.from("listing_import_assets").update({
        row_id: row.id,
        state: "matched",
        match_method: asset.method,
        sort_order: index,
        is_cover: index === 0,
      }).eq("id", asset.id).is("row_id", null);
    }
    await reconcileImportRowImages(admin, jobId, row.id);
  }
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
