import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const RESTORABLE_LISTING_FIELDS = [
  "address",
  "availability_date",
  "bathrooms",
  "bedrooms",
  "description",
  "electricity_estimate",
  "electricity_included",
  "electricity_type",
  "is_featured",
  "landlord_id",
  "latitude",
  "lease_duration",
  "listing_type",
  "location",
  "longitude",
  "metadata",
  "organization_id",
  "address_fingerprint",
  "parking_count",
  "parking_estimate",
  "parking_included",
  "parking_type",
  "price",
  "property_type",
  "sale_price",
  "security_fee_estimate",
  "status",
  "title",
  "water_availability",
  "water_estimate",
  "water_included",
  "wifi_available",
  "wifi_estimate",
  "wifi_included",
] as const;

function restorablePayload(before: Record<string, unknown>) {
  return Object.fromEntries(
    RESTORABLE_LISTING_FIELDS
      .filter((field) => Object.hasOwn(before, field))
      .map((field) => [field, before[field]]),
  );
}

export async function rollbackListingImport(
  admin: SupabaseClient,
  job: { id: string; organization_id: string; created_by: string; stage: string },
) {
  if (job.stage !== "complete") throw new Error("Only a completed import can be rolled back.");
  const { data, error } = await admin
    .from("listing_import_change_snapshots")
    .select("id, listing_id, operation, before_data, listing_updated_at_after, rolled_back_at")
    .eq("job_id", job.id)
    .is("rolled_back_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Rollback history is unavailable.");

  let restored = 0;
  let deletedDrafts = 0;
  let conflicts = 0;
  const rollbackVersions = new Map<string, string>();
  for (const snapshot of data ?? []) {
    const expectedUpdatedAt = rollbackVersions.get(snapshot.listing_id as string)
      ?? snapshot.listing_updated_at_after as string | null;
    if (!expectedUpdatedAt) {
      conflicts += 1;
      await admin.from("listing_import_change_snapshots")
        .update({ rollback_conflict_code: "missing_version" })
        .eq("id", snapshot.id);
      continue;
    }

    if (snapshot.operation === "create") {
      const { data: draftImages } = await admin.from("listing_images")
        .select("path")
        .eq("listing_id", snapshot.listing_id);
      const { data: removed } = await admin.from("listings")
        .delete()
        .eq("id", snapshot.listing_id)
        .eq("organization_id", job.organization_id)
        .eq("status", "draft")
        .eq("updated_at", expectedUpdatedAt)
        .select("id")
        .maybeSingle();
      if (removed) deletedDrafts += 1;
      else conflicts += 1;
      if (removed && draftImages?.length) {
        await admin.storage.from("listing-images").remove(draftImages.map((image) => image.path as string));
      }
      if (removed) rollbackVersions.delete(snapshot.listing_id as string);
      await admin.from("listing_import_change_snapshots").update(
        removed
          ? { rolled_back_at: new Date().toISOString(), rollback_conflict_code: null }
          : { rollback_conflict_code: "listing_changed_or_not_draft" },
      ).eq("id", snapshot.id);
      continue;
    }

    const before = snapshot.before_data as Record<string, unknown> | null;
    if (!before) {
      conflicts += 1;
      await admin.from("listing_import_change_snapshots")
        .update({ rollback_conflict_code: "snapshot_missing" })
        .eq("id", snapshot.id);
      continue;
    }
    const { data: restoredListing } = await admin.from("listings")
      .update({ ...restorablePayload(before), updated_at: new Date().toISOString() })
      .eq("id", snapshot.listing_id)
      .eq("organization_id", job.organization_id)
      .eq("updated_at", expectedUpdatedAt)
      .select("id, updated_at")
      .maybeSingle();
    if (restoredListing) restored += 1;
    else conflicts += 1;
    if (restoredListing) rollbackVersions.set(snapshot.listing_id as string, restoredListing.updated_at as string);
    if (restoredListing && Array.isArray(before.__images)) {
      const originalImages = before.__images as Array<Record<string, unknown>>;
      const originalPaths = new Set(originalImages.map((image) => String(image.path)));
      const { data: currentImages } = await admin.from("listing_images")
        .select("path")
        .eq("listing_id", snapshot.listing_id);
      const generatedPaths = (currentImages ?? [])
        .map((image) => image.path as string)
        .filter((path) => !originalPaths.has(path));
      await admin.from("listing_images").delete().eq("listing_id", snapshot.listing_id);
      if (originalImages.length) {
        await admin.from("listing_images").insert(originalImages.map((image) => ({
          id: image.id,
          listing_id: snapshot.listing_id,
          bucket: image.bucket,
          path: image.path,
          public_url: image.public_url,
          sort_order: image.sort_order,
          created_at: image.created_at,
        })));
      }
      if (generatedPaths.length) await admin.storage.from("listing-images").remove(generatedPaths);
    }
    await admin.from("listing_import_change_snapshots").update(
      restoredListing
        ? { rolled_back_at: new Date().toISOString(), rollback_conflict_code: null }
        : { rollback_conflict_code: "listing_changed_since_import" },
    ).eq("id", snapshot.id);
  }

  await admin.from("listing_import_events").insert({
    job_id: job.id,
    organization_id: job.organization_id,
    actor_id: job.created_by,
    event_type: "rollback_complete",
    aggregate_counts: { restored, deletedDrafts, conflicts },
    sanitized_detail: {},
  });
  await admin.from("listing_import_jobs").update({
    message_code: conflicts ? "rollback_conflicts" : "rollback_complete",
    message_detail: conflicts
      ? `${conflicts} listing changes require manual review.`
      : "All eligible import changes were rolled back.",
  }).eq("id", job.id);

  return { restored, deletedDrafts, conflicts };
}
