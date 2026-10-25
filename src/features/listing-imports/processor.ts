import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluatePublishReadiness } from "@/features/listings/publish-validation";
import { amenityCategories, emptyAmenities, type AmenitiesData } from "@/features/listings/schema";
import { logger } from "@/lib/logger";
import { createUntypedClient } from "@/lib/supabase/admin";

import { csvAdapter, jsonAdapter, pastedTableAdapter, pinpointV1Adapter, xlsxAdapter, xmlAdapter } from "./adapters";
import { batchGeocodeSouthAfricanAddresses } from "./geocoding";
import { IMPORT_LIMITS } from "./limits";
import {
  addressFingerprint,
  rowStateForIssues,
  validateCanonicalListing,
  type NormalizationIssue,
} from "./normalization";
import { enqueueImportJob } from "./queue";
import { attachImportAssets, rematchImportAssets } from "./assets";
import { LEGACY_IMPORT_REVIEW_MESSAGE, sameImportSelection } from "./selection";
import type {
  CanonicalImportListing,
  ImportJobMessage,
  ImportMapping,
  ImportSelection,
  ListingSourceAdapter,
} from "./types";

type ProcessorJob = {
  id: string;
  organization_id: string;
  created_by: string;
  source_kind: "csv" | "xlsx" | "xml" | "json" | "pasted_table" | "pinpoint_v1";
  source_path: string | null;
  mapping: ImportMapping;
  defaults: Partial<CanonicalImportListing> & { commitMode?: "drafts" | "final" };
  prepared_selection?: ImportSelection | null;
  sheet_name: string | null;
  record_path: string | null;
  stage: ImportJobMessage["stage"];
  stage_cursor: number;
  version: number;
  total_rows: number;
  processed_rows: number;
  valid_rows: number;
  warning_rows: number;
  blocked_rows: number;
  committed_rows: number;
  failed_rows: number;
  selection: ImportSelection;
  cancel_requested_at: string | null;
};

type DuplicateCandidate = {
  row_number: number;
  listing_id: string;
  match_kind: string;
  distance_metres: number | null;
};

type StagedRow = {
  id: string;
  row_number: number;
  state: string;
  prepared_state: string | null;
  normalized_data: CanonicalImportListing;
  duplicate_candidate_ids: string[];
  duplicate_strategy: "skip" | "replace" | "merge" | "import_new" | null;
  duplicate_listing_id: string | null;
  publication_selected: boolean;
  resulting_listing_id: string | null;
  listing_import_issues?: Array<{ severity: string; resolved_at: string | null }>;
};

function adapterFor(kind: ProcessorJob["source_kind"]): ListingSourceAdapter<unknown> {
  if (kind === "csv") return csvAdapter as ListingSourceAdapter<unknown>;
  if (kind === "xlsx") return xlsxAdapter as ListingSourceAdapter<unknown>;
  if (kind === "xml") return xmlAdapter as ListingSourceAdapter<unknown>;
  if (kind === "json") return jsonAdapter as ListingSourceAdapter<unknown>;
  if (kind === "pasted_table") return pastedTableAdapter as ListingSourceAdapter<unknown>;
  return pinpointV1Adapter as ListingSourceAdapter<unknown>;
}

async function sourceForJob(admin: SupabaseClient, job: ProcessorJob) {
  if (!job.source_path) throw new Error("source_path_missing");
  const { data, error } = await admin.storage.from("listing-imports").download(job.source_path);
  if (error || !data) throw new Error("source_download_failed");
  if (job.source_kind === "xlsx") return data;
  return data.text();
}

async function geocodeMissingCoordinates(
  admin: SupabaseClient,
  organizationId: string,
  records: CanonicalImportListing[],
) {
  const missing = records
    .map((listing, index) => ({ listing, index }))
    .filter(({ listing }) => listing.address && (listing.latitude === undefined || listing.longitude === undefined));
  const fingerprints = missing.map(({ listing }) => addressFingerprint(listing.address)).filter(Boolean) as string[];
  const { data: cached } = fingerprints.length
    ? await admin.from("listing_import_geocode_cache")
      .select("address_fingerprint, latitude, longitude")
      .eq("organization_id", organizationId)
      .gt("expires_at", new Date().toISOString())
      .in("address_fingerprint", fingerprints)
    : { data: [] };
  const cacheByFingerprint = new Map((cached ?? []).map((item) => [item.address_fingerprint, item]));
  const uncached = missing.filter(({ listing }) => {
    const fingerprint = addressFingerprint(listing.address);
    const match = fingerprint ? cacheByFingerprint.get(fingerprint) : undefined;
    if (!match || match.latitude == null || match.longitude == null) return true;
    listing.latitude = Number(match.latitude);
    listing.longitude = Number(match.longitude);
    return false;
  });

  for (let offset = 0; offset < uncached.length; offset += IMPORT_LIMITS.geocodeBatchSize) {
    const group = uncached.slice(offset, offset + IMPORT_LIMITS.geocodeBatchSize);
    const results = await batchGeocodeSouthAfricanAddresses(group.map(({ listing }) => listing.address!));
    results.forEach((result, index) => {
      if (result.ambiguous) return;
      const target = group[index]?.listing;
      if (target) {
        target.latitude = result.latitude;
        target.longitude = result.longitude;
      }
    });
    const cacheRows = results.flatMap((result, index) => {
      const target = group[index]?.listing;
      const fingerprint = addressFingerprint(target?.address);
      if (result.ambiguous || !fingerprint || result.latitude === undefined || result.longitude === undefined) return [];
      return [{
        organization_id: organizationId,
        address_fingerprint: fingerprint,
        latitude: result.latitude,
        longitude: result.longitude,
        confidence: result.confidence ?? null,
        result_metadata: { source: "maptiler", country: "za" },
        expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1_000).toISOString(),
      }];
    });
    if (cacheRows.length) {
      await admin.from("listing_import_geocode_cache").upsert(cacheRows, {
        onConflict: "organization_id,address_fingerprint",
      });
    }
  }
}

function issueRows(job: ProcessorJob, rowId: string, issues: NormalizationIssue[]) {
  return issues.map((issue) => ({
    job_id: job.id,
    row_id: rowId,
    organization_id: job.organization_id,
    severity: issue.severity,
    code: issue.code,
    field: issue.field ?? null,
    message: issue.message,
  }));
}

async function validateChunk(admin: SupabaseClient, job: ProcessorJob, claimVersion: number, requestId: string) {
  const startedAt = Date.now();
  const source = await sourceForJob(admin, job);
  const adapter = adapterFor(job.source_kind);
  const parsed = await adapter.parseChunk(source, {
    cursor: job.stage_cursor,
    limit: IMPORT_LIMITS.chunkRows,
    sheet: job.sheet_name ?? undefined,
    recordPath: job.record_path ?? undefined,
  });
  const normalized = parsed.map((record) => adapter.normalize(record, job.mapping, job.defaults));
  await geocodeMissingCoordinates(admin, job.organization_id, normalized);

  const candidatePayload = normalized.map((listing, index) => ({
    rowNumber: parsed[index]!.rowNumber,
    sourceReference: listing.sourceReference ?? null,
    addressFingerprint: addressFingerprint(listing.address) ?? null,
    listingType: listing.listingType ?? "rent",
    longitude: listing.longitude ?? null,
    latitude: listing.latitude ?? null,
  }));
  const { data: duplicateRows } = await admin.rpc("find_listing_import_duplicate_candidates", {
    target_organization_id: job.organization_id,
    provider_name: job.source_kind,
    candidates: candidatePayload,
  });
  const candidatesByRow = new Map<number, DuplicateCandidate[]>();
  for (const candidate of (duplicateRows ?? []) as DuplicateCandidate[]) {
    const current = candidatesByRow.get(candidate.row_number) ?? [];
    if (!current.some((item) => item.listing_id === candidate.listing_id)) current.push(candidate);
    candidatesByRow.set(candidate.row_number, current);
  }

  let valid = 0;
  let warnings = 0;
  let blocked = 0;
  const rows = parsed.map((record, index) => {
    const listing = normalized[index]!;
    const issues = validateCanonicalListing(listing);
    const candidates = candidatesByRow.get(record.rowNumber) ?? [];
    if (candidates.length) {
      issues.push({
        severity: "warning",
        code: candidates.length > 1 ? "ambiguous_duplicate" : (
          candidates[0]!.match_kind === "external_reference"
            ? "duplicate_external_reference"
            : candidates[0]!.match_kind === "address_fingerprint"
              ? "duplicate_address"
              : "duplicate_coordinates"
        ),
        message: candidates.length > 1 ? "Review the possible duplicate listings." : "Review the matched existing listing.",
      });
    }
    const state = candidates.length ? "duplicate_review" : rowStateForIssues(issues);
    if (state === "parse_blocked") blocked += 1;
    else if (state === "warning" || state === "publish_blocked" || state === "duplicate_review") warnings += 1;
    else valid += 1;
    return {
      job_id: job.id,
      organization_id: job.organization_id,
      row_number: record.rowNumber,
      raw_data: record.raw,
      normalized_data: listing,
      unmapped_data: Object.fromEntries(Object.entries(record.raw).filter(([key]) => !job.mapping[key])),
      state,
      address_fingerprint: addressFingerprint(listing.address) ?? null,
      duplicate_candidate_ids: candidates.map((candidate) => candidate.listing_id),
      responsible_agent_id: listing.responsibleAgentId ?? null,
      office_id: listing.officeId ?? null,
      publication_selected: listing.publicationSelected ?? false,
      issues,
    };
  });

  for (let offset = 0; offset < rows.length; offset += IMPORT_LIMITS.progressRows) {
    const group = rows.slice(offset, offset + IMPORT_LIMITS.progressRows);
    const persisted = group.map(({ issues, ...row }) => {
      void issues;
      return row;
    });
    const { data: savedRows, error } = await admin
      .from("listing_import_rows")
      .upsert(persisted, { onConflict: "job_id,row_number" })
      .select("id, row_number");
    if (error) throw new Error("row_stage_failed");

    const savedByNumber = new Map((savedRows ?? []).map((row) => [row.row_number, row.id]));
    const rowIds = [...savedByNumber.values()];
    if (rowIds.length) await admin.from("listing_import_issues").delete().in("row_id", rowIds);
    const issues = group.flatMap((row) => {
      const rowId = savedByNumber.get(row.row_number);
      return rowId ? issueRows(job, rowId, row.issues) : [];
    });
    if (issues.length) await admin.from("listing_import_issues").insert(issues);

    await admin.from("listing_import_jobs").update({
      heartbeat_at: new Date().toISOString(),
      last_progress_at: new Date().toISOString(),
      processed_rows: job.stage_cursor + offset + group.length,
    }).eq("id", job.id).eq("version", claimVersion);
  }

  const nextCursor = job.stage_cursor + parsed.length;
  const finished = parsed.length < IMPORT_LIMITS.chunkRows || nextCursor >= IMPORT_LIMITS.maxRows;
  if (finished) await rematchImportAssets(admin, job.id);
  const nextVersion = claimVersion + 1;
  const { error: progressError } = await admin.from("listing_import_jobs").update({
    stage: finished ? "resolving" : "validating",
    stage_cursor: finished ? 0 : nextCursor,
    total_rows: finished ? nextCursor : Math.max(job.total_rows, nextCursor),
    processed_rows: nextCursor,
    valid_rows: job.valid_rows + valid,
    warning_rows: job.warning_rows + warnings,
    blocked_rows: job.blocked_rows + blocked,
    version: nextVersion,
    heartbeat_at: new Date().toISOString(),
    last_progress_at: new Date().toISOString(),
    message_code: finished ? "validation_complete" : "validation_in_progress",
  }).eq("id", job.id).eq("version", claimVersion);
  if (progressError) throw new Error("stale_validation_cursor");

  await admin.from("listing_import_events").insert({
    job_id: job.id,
    organization_id: job.organization_id,
    actor_id: job.created_by,
    event_type: finished ? "validation_complete" : "validation_chunk",
    stage: "validating",
    cursor: nextCursor,
    aggregate_counts: { processed: parsed.length, valid, warnings, blocked },
    sanitized_detail: { durationMs: Date.now() - startedAt },
  });

  logger.info("Listing import validation chunk complete", {
    requestId,
    jobId: job.id,
    organizationId: job.organization_id,
    stage: "validating",
    cursor: nextCursor,
    durationMs: Date.now() - startedAt,
    counts: { processed: parsed.length, valid, warnings, blocked },
  });

  if (!finished) {
    try {
      await enqueueImportJob(
        { jobId: job.id, stage: "validating", cursor: nextCursor, attempt: 0, version: nextVersion },
        job.organization_id,
      );
    } catch {
      await admin.from("listing_import_jobs").update({
        stage: "failed",
        defaults: { ...job.defaults, resumeStage: "validating" },
        message_code: "queue_delivery_failed",
        message_detail: "The next validation chunk could not be queued. Retry from the durable cursor.",
        version: nextVersion + 1,
      }).eq("id", job.id).eq("version", nextVersion);
    }
  }
}

function listingPayload(listing: CanonicalImportListing, job: ProcessorJob) {
  const listingType = listing.listingType ?? "rent";
  const price = listingType === "sale" ? listing.salePrice : listing.price;
  const staging = listing as CanonicalImportListing & { status?: "draft" | "published" | "archived"; archive?: boolean };
  return {
    organization_id: job.organization_id,
    landlord_id: listing.responsibleAgentId,
    listing_type: listingType,
    title: listing.title,
    description: listing.description ?? null,
    property_type: listing.propertyType ?? null,
    price,
    sale_price: listingType === "sale" ? listing.salePrice : null,
    address: listing.address,
    address_fingerprint: addressFingerprint(listing.address) ?? null,
    latitude: listing.latitude ?? null,
    longitude: listing.longitude ?? null,
    bedrooms: listing.bedrooms ?? null,
    bathrooms: listing.bathrooms ?? null,
    parking_type: listing.parkingType ?? null,
    parking_count: listing.parkingCount ?? null,
    electricity_type: listing.electricityType ?? null,
    water_availability: listing.waterAvailability ?? null,
    lease_duration: listing.leaseDuration ?? null,
    availability_date: listing.availabilityDate ?? null,
    metadata: { amenities: importedAmenities(listing.amenities) },
    is_featured: listing.isFeatured ?? false,
    status: staging.archive ? "archived" : staging.status,
  };
}

function importedAmenities(values: string[] | undefined): AmenitiesData {
  const output: AmenitiesData = {
    essentials: [],
    security: [],
    lifestyle: [],
    appliances: [],
  };
  for (const value of values ?? []) {
    const normalized = value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    for (const category of Object.keys(amenityCategories) as Array<keyof AmenitiesData>) {
      if ((amenityCategories[category].items as readonly string[]).includes(normalized)) {
        const bucket = output[category] as string[];
        if (!bucket.includes(normalized)) bucket.push(normalized);
        break;
      }
    }
  }
  return output;
}

function mergedMetadata(before: unknown, incoming: unknown) {
  const beforeMetadata = before && typeof before === "object" && !Array.isArray(before)
    ? before as Record<string, unknown>
    : {};
  const incomingMetadata = incoming && typeof incoming === "object" && !Array.isArray(incoming)
    ? incoming as Record<string, unknown>
    : {};
  const beforeAmenities = beforeMetadata.amenities && typeof beforeMetadata.amenities === "object" && !Array.isArray(beforeMetadata.amenities)
    ? beforeMetadata.amenities as Partial<AmenitiesData>
    : emptyAmenities;
  const incomingAmenities = incomingMetadata.amenities && typeof incomingMetadata.amenities === "object" && !Array.isArray(incomingMetadata.amenities)
    ? incomingMetadata.amenities as Partial<AmenitiesData>
    : emptyAmenities;
  return {
    ...beforeMetadata,
    ...incomingMetadata,
    amenities: Object.fromEntries((Object.keys(emptyAmenities) as Array<keyof AmenitiesData>).map((category) => [
      category,
      [...new Set([...(beforeAmenities[category] ?? []), ...(incomingAmenities[category] ?? [])])],
    ])),
  };
}

function selected(selection: ImportSelection, row: StagedRow) {
  if (selection.mode === "explicit") return selection.included.includes(row.id);
  if (selection.excluded.includes(row.id)) return false;
  if (selection.filter.states?.length && !selection.filter.states.includes(row.state as never)) return false;
  if (selection.filter.duplicateOnly && row.duplicate_candidate_ids.length === 0) return false;
  if (selection.filter.severities?.length && !row.listing_import_issues?.some(
    (issue) => !issue.resolved_at && selection.filter.severities!.includes(issue.severity as never),
  )) return false;
  const needle = selection.filter.query?.toLowerCase();
  return !needle || [row.normalized_data.title, row.normalized_data.address, row.normalized_data.sourceReference]
    .some((value) => value?.toLowerCase().includes(needle));
}

async function requireImportAssignee(admin: SupabaseClient, job: ProcessorJob, listing: CanonicalImportListing) {
  if (!listing.responsibleAgentId) throw new Error("responsible_agent_unavailable");
  const [membership, suspension] = await Promise.all([
    admin.from("organization_memberships").select("user_id")
      .eq("organization_id", job.organization_id).eq("user_id", listing.responsibleAgentId)
      .is("revoked_at", null).maybeSingle(),
    admin.from("account_suspensions").select("suspended_until")
      .eq("user_id", listing.responsibleAgentId).is("restored_at", null).maybeSingle(),
  ]);
  if (membership.error || !membership.data || suspension.error || (suspension.data && (
    !suspension.data.suspended_until || new Date(suspension.data.suspended_until) > new Date()
  ))) throw new Error("responsible_agent_unavailable");
  if (listing.officeId) {
    const office = await admin.from("organization_offices").select("id")
      .eq("id", listing.officeId).eq("organization_id", job.organization_id).maybeSingle();
    if (office.error || !office.data) throw new Error("organization_office_unavailable");
  }
}

async function createDraft(admin: SupabaseClient, job: ProcessorJob, row: StagedRow) {
  await requireImportAssignee(admin, job, row.normalized_data);
  const payload = listingPayload(row.normalized_data, job);
  const { data: listing, error } = await admin.from("listings").insert({ ...payload, status: "draft" }).select("id, updated_at").single();
  if (error || !listing) throw new Error("draft_create_failed");
  if (row.normalized_data.sourceReference) {
    const sourceReference = row.duplicate_strategy === "import_new"
      ? `${row.normalized_data.sourceReference}#${job.id.slice(0, 8)}-${row.row_number}`
      : row.normalized_data.sourceReference;
    await admin.from("listing_external_refs").upsert({
      organization_id: job.organization_id,
      listing_id: listing.id,
      provider: job.source_kind,
      source_reference: sourceReference,
    }, { onConflict: "organization_id,provider,source_reference" });
  }
  await attachImportAssets(admin, job, row.id, listing.id, "create");
  await admin.from("listing_import_change_snapshots").insert({
    job_id: job.id,
    organization_id: job.organization_id,
    row_id: row.id,
    listing_id: listing.id,
    operation: "create",
    before_data: null,
    after_data: payload,
    listing_updated_at_after: listing.updated_at,
  });
  await admin.from("listing_import_rows").update({
    resulting_listing_id: listing.id,
    state: "committed",
    processed_at: new Date().toISOString(),
  }).eq("id", row.id);
  return listing.id as string;
}

async function applyExistingChange(admin: SupabaseClient, job: ProcessorJob, row: StagedRow) {
  if (
    !row.duplicate_listing_id
    || (row.duplicate_strategy !== "replace" && row.duplicate_strategy !== "merge")
  ) throw new Error("duplicate_listing_unavailable");
  if (!row.duplicate_candidate_ids.includes(row.duplicate_listing_id)) throw new Error("duplicate_listing_unavailable");
  await requireImportAssignee(admin, job, row.normalized_data);
  const { data: before, error } = await admin.from("listings").select("*")
    .eq("id", row.duplicate_listing_id).eq("organization_id", job.organization_id).single();
  if (error || !before) throw new Error("duplicate_listing_missing");
  const incoming = listingPayload(row.normalized_data, job);
  const payload = row.duplicate_strategy === "merge"
    ? {
      ...Object.fromEntries(Object.entries(incoming).map(([key, value]) => {
        const existing = before[key];
        return [key, existing == null || (typeof existing === "string" && !existing.trim()) ? value : existing];
      })),
      metadata: mergedMetadata(before.metadata, incoming.metadata),
      status: incoming.status ?? before.status,
    }
    : incoming;

  const [{ data: beforeImages, count: imageCount }, { count: suppliedImageCount }] = await Promise.all([
    admin.from("listing_images").select("id, bucket, path, public_url, sort_order, created_at", { count: "exact" }).eq("listing_id", before.id),
    admin.from("listing_import_assets").select("id", { head: true, count: "exact" }).eq("row_id", row.id).in("state", ["matched", "uploaded"]),
  ]);
  const resultingImageCount = row.duplicate_strategy === "replace" && (suppliedImageCount ?? 0) > 0
    ? suppliedImageCount ?? 0
    : Math.min(20, (imageCount ?? 0) + (suppliedImageCount ?? 0));
  if (before.status === "published" && !evaluatePublishReadiness({ ...before, ...payload }, resultingImageCount).ready) {
    throw new Error("published_result_not_ready");
  }

  const { data: updated, error: updateError } = await admin.from("listings")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", before.id)
    .eq("organization_id", job.organization_id)
    .eq("updated_at", before.updated_at)
    .select("*")
    .single();
  if (updateError || !updated) throw new Error("duplicate_update_conflict");
  await attachImportAssets(admin, job, row.id, updated.id, row.duplicate_strategy);

  await admin.from("listing_import_change_snapshots").insert({
    job_id: job.id,
    organization_id: job.organization_id,
    row_id: row.id,
    listing_id: updated.id,
    operation: row.duplicate_strategy,
    before_data: { ...before, __images: beforeImages ?? [] },
    after_data: updated,
    listing_updated_at_before: before.updated_at,
    listing_updated_at_after: updated.updated_at,
  });
  await admin.from("listing_import_rows").update({
    resulting_listing_id: updated.id,
    state: "committed",
    processed_at: new Date().toISOString(),
  }).eq("id", row.id);
  return updated.id as string;
}

async function commitChunk(admin: SupabaseClient, job: ProcessorJob, claimVersion: number, requestId: string) {
  const startedAt = Date.now();
  const { data, error } = await admin.from("listing_import_rows")
    .select("id, row_number, state, prepared_state, normalized_data, duplicate_candidate_ids, duplicate_strategy, duplicate_listing_id, publication_selected, resulting_listing_id, listing_import_issues(severity, resolved_at)")
    .eq("job_id", job.id)
    .gt("row_number", job.stage_cursor)
    .order("row_number", { ascending: true })
    .limit(IMPORT_LIMITS.chunkRows);
  if (error) throw new Error("commit_rows_unavailable");
  const rows = (data ?? []) as StagedRow[];
  const preparedSelection = job.defaults.commitMode === "final" ? job.prepared_selection : null;
  const unchangedSelection = preparedSelection ? sameImportSelection(job.selection, preparedSelection) : false;
  const chosen = rows.filter((row) => preparedSelection
    ? row.publication_selected && (unchangedSelection || selected(job.selection, {
      ...row, state: row.prepared_state ?? row.state,
    }))
    : selected(job.selection, row));
  let committed = 0;
  let failed = 0;

  for (const row of chosen) {
    if (["parse_blocked", "removed", "skipped", "failed"].includes(row.state)) continue;
    try {
      let listingChanged = false;
      if (job.defaults.commitMode === "final") {
        if (row.duplicate_strategy === "replace" || row.duplicate_strategy === "merge") {
          await applyExistingChange(admin, job, row);
          listingChanged = true;
        } else if (row.resulting_listing_id && row.publication_selected) {
          const { data: listing } = await admin.from("listings").select("*")
            .eq("id", row.resulting_listing_id).eq("organization_id", job.organization_id).single();
          if (!listing) throw new Error("publish_listing_unavailable");
          await requireImportAssignee(admin, job, row.normalized_data);
          const { count } = await admin.from("listing_images").select("id", { head: true, count: "exact" }).eq("listing_id", row.resulting_listing_id);
          if (!listing || !evaluatePublishReadiness(listing, count ?? 0).ready) throw new Error("publish_readiness_failed");
          const { data: published, error: publishError } = await admin.from("listings")
            .update({ status: "published", updated_at: new Date().toISOString() })
            .eq("id", row.resulting_listing_id)
            .eq("organization_id", job.organization_id)
            .eq("status", "draft")
            .eq("updated_at", listing.updated_at)
            .select("*")
            .single();
          if (publishError || !published) throw new Error("publish_conflict");
          await admin.from("listing_import_change_snapshots").insert({
            job_id: job.id,
            organization_id: job.organization_id,
            row_id: row.id,
            listing_id: published.id,
            operation: "publish",
            before_data: listing,
            after_data: published,
            listing_updated_at_before: listing.updated_at,
            listing_updated_at_after: published.updated_at,
          });
          await admin.from("listing_import_rows").update({ state: "published" }).eq("id", row.id);
          listingChanged = true;
        }
      } else if (!row.resulting_listing_id && (
        row.duplicate_candidate_ids.length === 0 || row.duplicate_strategy === "import_new"
      ) && !["parse_blocked", "removed", "failed"].includes(row.state)) {
        await createDraft(admin, job, row);
        listingChanged = true;
      }
      if (listingChanged) committed += 1;
    } catch (error) {
      failed += 1;
      const code = error instanceof Error ? error.message : "row_write_failed";
      await admin.from("listing_import_rows").update({ state: "failed" }).eq("id", row.id);
      await admin.from("listing_import_issues").insert({
        job_id: job.id,
        row_id: row.id,
        organization_id: job.organization_id,
        severity: "blocking",
        code: "row_write_failed",
        message: `This row could not be committed (${code}).`,
      });
    }
  }

  const nextCursor = rows.at(-1)?.row_number ?? job.stage_cursor;
  const finished = rows.length < IMPORT_LIMITS.chunkRows;
  const [durableRows, failedRows] = await Promise.all([
    admin.from("listing_import_rows").select("id", { head: true, count: "exact" })
      .eq("job_id", job.id).in("state", ["committed", "published"]),
    admin.from("listing_import_rows").select("id", { head: true, count: "exact" })
      .eq("job_id", job.id).eq("state", "failed"),
  ]);
  if (durableRows.error || failedRows.error || durableRows.count === null || failedRows.count === null) {
    throw new Error("commit_counts_unavailable");
  }
  const nextVersion = claimVersion + 1;
  const nextStage = finished ? (job.defaults.commitMode === "final" ? "complete" : "confirming") : "committing";
  const { error: progressError } = await admin.from("listing_import_jobs").update({
    stage: nextStage,
    stage_cursor: finished ? 0 : nextCursor,
    committed_rows: durableRows.count,
    failed_rows: failedRows.count,
    completed_at: nextStage === "complete" ? new Date().toISOString() : null,
    version: nextVersion,
    heartbeat_at: new Date().toISOString(),
    last_progress_at: new Date().toISOString(),
    message_code: nextStage === "complete" ? "import_complete" : nextStage === "confirming" ? "final_confirmation_required" : "commit_in_progress",
  }).eq("id", job.id).eq("version", claimVersion);
  if (progressError) throw new Error("stale_commit_cursor");

  await admin.from("listing_import_events").insert({
    job_id: job.id,
    organization_id: job.organization_id,
    actor_id: job.created_by,
    event_type: nextStage === "complete" ? "import_complete" : "commit_chunk",
    stage: "committing",
    cursor: nextCursor,
    aggregate_counts: { committed, failed },
    sanitized_detail: { durationMs: Date.now() - startedAt, mode: job.defaults.commitMode },
  });
  logger.info("Listing import commit chunk complete", {
    requestId,
    jobId: job.id,
    organizationId: job.organization_id,
    stage: "committing",
    cursor: nextCursor,
    durationMs: Date.now() - startedAt,
    counts: { committed, failed },
  });

  if (!finished) {
    try {
      await enqueueImportJob(
        { jobId: job.id, stage: "committing", cursor: nextCursor, attempt: 0, version: nextVersion },
        job.organization_id,
      );
    } catch {
      await admin.from("listing_import_jobs").update({
        stage: "failed",
        defaults: { ...job.defaults, resumeStage: "committing" },
        message_code: "queue_delivery_failed",
        message_detail: "The next commit chunk could not be queued. Retry from the durable cursor.",
        version: nextVersion + 1,
      }).eq("id", job.id).eq("version", nextVersion);
    }
  }
}

export async function processListingImportMessage(message: ImportJobMessage, requestId: string) {
  const admin = createUntypedClient() as unknown as SupabaseClient;
  const { data: claims, error: claimError } = await admin.rpc("claim_listing_import_chunk", {
    target_job_id: message.jobId,
    expected_stage: message.stage,
    expected_cursor: message.cursor,
    expected_version: message.version,
    chunk_size: IMPORT_LIMITS.chunkRows,
  });
  const claim = (claims as Array<{ claimed: boolean; version: number; cancelled: boolean }> | null)?.[0];
  if (claimError || !claim?.claimed) {
    const { data: current } = await admin.from("listing_import_jobs")
      .select("id, organization_id, created_by, stage, stage_cursor, version")
      .eq("id", message.jobId)
      .maybeSingle();
    if (
      current
      && current.stage === message.stage
      && Number(current.stage_cursor) === message.cursor
      && Number(current.version) === message.version
    ) {
      const { data: membership } = await admin.from("organization_memberships")
        .select("id")
        .eq("organization_id", current.organization_id)
        .eq("user_id", current.created_by)
        .in("role", ["owner", "admin"])
        .is("revoked_at", null)
        .maybeSingle();
      if (!membership) {
        await admin.from("listing_import_jobs").update({
          stage: "failed",
          version: message.version + 1,
          message_code: "membership_revoked",
          message_detail: "The member who started this import no longer has import access. An owner or admin can retry it.",
        }).eq("id", current.id).eq("version", message.version);
        return { processed: false, reason: "membership_revoked" as const };
      }
    }
    return { processed: false, reason: "stale_or_unavailable" as const };
  }

  const { data, error } = await admin.from("listing_import_jobs").select("*").eq("id", message.jobId).single();
  if (error || !data) throw new Error("job_unavailable_after_claim");
  const job = data as ProcessorJob;
  if (claim.cancelled || job.cancel_requested_at) {
    await admin.from("listing_import_jobs").update({
      stage: "cancelled",
      cancelled_at: new Date().toISOString(),
      message_code: "cancelled",
      version: claim.version + 1,
    }).eq("id", job.id).eq("version", claim.version);
    return { processed: true, reason: "cancelled" as const };
  }

  try {
    if (job.stage === "committing" && job.defaults.commitMode === "final" && !job.prepared_selection) {
      const { data: stopped, error: stopError } = await admin.from("listing_import_jobs").update({
        stage: "confirming",
        completed_at: null,
        message_code: "selection_review_required",
        message_detail: LEGACY_IMPORT_REVIEW_MESSAGE,
        version: claim.version + 1,
        heartbeat_at: new Date().toISOString(),
        last_progress_at: new Date().toISOString(),
      }).eq("id", job.id).eq("stage", "committing").eq("version", claim.version).select("id").maybeSingle();
      if (stopError) throw new Error("selection_review_unavailable");
      return stopped
        ? { processed: true, reason: "selection_review_required" as const }
        : { processed: false, reason: "stale_or_unavailable" as const };
    }
    if (job.stage === "validating") await validateChunk(admin, job, claim.version, requestId);
    else if (job.stage === "committing") await commitChunk(admin, job, claim.version, requestId);
    else return { processed: false, reason: "stage_noop" as const };
  } catch (error) {
    const finalAttempt = message.attempt >= 2;
    const failureCode = error instanceof Error ? error.message : "worker_failure";
    if (finalAttempt) {
      await admin.from("listing_import_jobs").update({
        stage: "failed",
        defaults: { ...job.defaults, resumeStage: job.stage },
        version: claim.version + 1,
        heartbeat_at: new Date().toISOString(),
        message_code: failureCode,
        message_detail: "Processing failed after three attempts. Review the failure code, then retry from the durable cursor.",
      }).eq("id", job.id).eq("version", claim.version);
    } else {
      await admin.from("listing_import_jobs").update({
        version: message.version,
        heartbeat_at: null,
        message_code: "retry_scheduled",
        message_detail: null,
      }).eq("id", job.id).eq("version", claim.version);
    }
    throw error;
  }
  return { processed: true, reason: "complete" as const };
}
