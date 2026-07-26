"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { appendAdminAudit } from "@/features/admin/audit";
import { requireAdmin } from "@/features/admin/auth";
import { actionFailure, actionSuccess } from "@/lib/action-result";
import { logger } from "@/lib/logger";
import { createUntypedClient } from "@/lib/supabase/admin";

import { privacyRequestAdminSchema, transparencyPeriodSchema, trustApprovalSchema, trustDocumentIdSchema, trustDraftSchema, trustRollbackSchema, trustVersionIdSchema, verificationCheckSchema } from "./schemas";

async function requestId() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-request-id") ?? requestHeaders.get("cf-ray") ?? randomUUID();
}

function revalidateTrust(slug?: string | null, documentId?: string) {
  revalidatePath("/trust");
  revalidatePath("/admin/trust");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/trust/${slug}`);
  if (documentId) revalidatePath(`/admin/trust/${documentId}`);
}

async function removeUserOwnedStorage(userId: string) {
  const admin = createUntypedClient();
  const [{ data: listings }, { data: applications }, { data: exports }] = await Promise.all([
    admin.from("listings").select("id").eq("landlord_id", userId),
    admin.from("applications").select("id").eq("renter_id", userId),
    admin.from("privacy_requests").select("artifact_bucket, artifact_path").eq("user_id", userId).not("artifact_path", "is", null),
  ]);
  const listingIds = (listings ?? []).map((item) => item.id);
  const applicationIds = (applications ?? []).map((item) => item.id);
  const [{ data: images }, { data: documents }] = await Promise.all([
    listingIds.length ? admin.from("listing_images").select("bucket, path").in("listing_id", listingIds) : Promise.resolve({ data: [] }),
    applicationIds.length ? admin.from("documents").select("bucket, path").in("application_id", applicationIds) : Promise.resolve({ data: [] }),
  ]);
  const files = [...(images ?? []), ...(documents ?? []), ...(exports ?? [])].reduce((groups, file) => {
    const bucket = "bucket" in file ? file.bucket : file.artifact_bucket;
    const path = "path" in file ? file.path : file.artifact_path;
    if (bucket && path) (groups[bucket] ??= []).push(path);
    return groups;
  }, {} as Record<string, string[]>);
  for (const [bucket, paths] of Object.entries(files)) {
    const { error } = await admin.storage.from(bucket).remove([...new Set(paths)]);
    if (error) throw error;
  }
}

async function completeDeletionRequest(input: { actorId: string; userId: string; privacyRequestId: string; requestId: string }) {
  const admin = createUntypedClient();
  await removeUserOwnedStorage(input.userId);
  const { error: sessionError } = await admin.rpc("admin_revoke_user_sessions", {
    actor: input.actorId,
    target_user: input.userId,
    audit_request_id: input.requestId,
  });
  if (sessionError) throw sessionError;
  const { error: deletionError } = await admin.auth.admin.deleteUser(input.userId);
  if (deletionError) throw deletionError;
  logger.info("Privacy deletion executed", { requestId: input.requestId, actorId: input.actorId, privacyRequestId: input.privacyRequestId });
}

export async function createTrustDraft(documentId: string) {
  const parsed = trustDocumentIdSchema.safeParse(documentId);
  if (!parsed.success) return actionFailure("Invalid trust document.");
  const context = await requireAdmin();
  const id = await requestId();
  const admin = createUntypedClient();
  const { data: document } = await admin.from("trust_documents").select("id, slug").eq("id", parsed.data).maybeSingle();
  if (!document) return actionFailure("The trust document could not be found.");
  const { data: latest } = await admin.from("trust_document_versions").select("version, body_markdown, requires_reacceptance").eq("document_id", document.id).order("version", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await admin.from("trust_document_versions").insert({
    document_id: document.id,
    version: Number(latest?.version ?? 0) + 1,
    status: "draft",
    body_markdown: latest?.body_markdown ?? "## Start here\n\nReplace this draft with counsel-reviewed policy content before publication.",
    change_summary: "New review draft.",
    requires_reacceptance: Boolean(latest?.requires_reacceptance),
    drafted_by: context.user.id,
  }).select("id").maybeSingle();
  if (error || !data) {
    logger.error("Trust draft creation failed", { requestId: id, actorId: context.user.id, documentId: document.id, error });
    return actionFailure("The trust draft could not be created.");
  }
  await appendAdminAudit({ actorId: context.user.id, actionKey: "trust.version_created", targetType: "trust_document_version", targetId: data.id, requestId: id, metadata: { documentId: document.id } });
  revalidateTrust(document.slug, document.id);
  return actionSuccess({ id: String(data.id) });
}

export async function saveTrustDraft(input: unknown) {
  const parsed = trustDraftSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Complete the policy body and change summary.", parsed.error.flatten());
  const context = await requireAdmin();
  const id = await requestId();
  const admin = createUntypedClient();
  const { data: version } = await admin.from("trust_document_versions").select("id, status, document_id, document:trust_documents!trust_document_versions_document_id_fkey(slug)").eq("id", parsed.data.id).maybeSingle();
  if (!version) return actionFailure("The policy version could not be found.");
  if (!["draft", "in_review"].includes(version.status)) return actionFailure("Create a new version before editing approved or published content.");
  const { error } = await admin.from("trust_document_versions").update({
    body_markdown: parsed.data.bodyMarkdown,
    change_summary: parsed.data.changeSummary,
    requires_reacceptance: parsed.data.requiresReacceptance,
    status: "draft",
    external_reviewer_name: null,
    counsel_reference: null,
    reviewed_at: null,
    approved_by: null,
    approved_at: null,
  }).eq("id", version.id);
  if (error) {
    logger.error("Trust draft save failed", { requestId: id, actorId: context.user.id, versionId: version.id, error });
    return actionFailure("The policy draft could not be saved.");
  }
  await appendAdminAudit({ actorId: context.user.id, actionKey: "trust.version_saved", targetType: "trust_document_version", targetId: version.id, requestId: id });
  const relation = (version as unknown as { document?: { slug?: string } | { slug?: string }[] }).document;
  const slug = Array.isArray(relation) ? relation[0]?.slug : relation?.slug;
  revalidateTrust(slug, version.document_id);
  return actionSuccess(undefined);
}

export async function submitTrustVersion(versionId: string) {
  const parsed = trustVersionIdSchema.safeParse(versionId);
  if (!parsed.success) return actionFailure("Invalid policy version.");
  const context = await requireAdmin();
  const id = await requestId();
  const admin = createUntypedClient();
  const { data: version } = await admin.from("trust_document_versions").select("id, status, body_markdown, document_id").eq("id", parsed.data).maybeSingle();
  if (!version || version.status !== "draft" || String(version.body_markdown).trim().length < 200) return actionFailure("Save a complete draft before submitting it for review.");
  const { error } = await admin.from("trust_document_versions").update({ status: "in_review" }).eq("id", version.id);
  if (error) return actionFailure("The policy could not be submitted for review.");
  await appendAdminAudit({ actorId: context.user.id, actionKey: "trust.version_submitted", targetType: "trust_document_version", targetId: version.id, requestId: id });
  revalidateTrust(null, version.document_id);
  return actionSuccess(undefined);
}

export async function approveTrustVersion(input: unknown) {
  const parsed = trustApprovalSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Record the counsel reviewer, reference, and review date.", parsed.error.flatten());
  const context = await requireAdmin({ ownerOnly: true });
  const id = await requestId();
  const admin = createUntypedClient();
  const { data: version } = await admin.from("trust_document_versions").select("id, status, document_id").eq("id", parsed.data.id).maybeSingle();
  if (!version || version.status !== "in_review") return actionFailure("Only a version in review can be approved.");
  const { error } = await admin.from("trust_document_versions").update({
    status: "approved",
    external_reviewer_name: parsed.data.externalReviewerName,
    counsel_reference: parsed.data.counselReference,
    reviewed_at: parsed.data.reviewedAt,
    approved_by: context.user.id,
    approved_at: new Date().toISOString(),
  }).eq("id", version.id);
  if (error) {
    logger.error("Trust approval failed", { requestId: id, actorId: context.user.id, versionId: version.id, error });
    return actionFailure("The policy approval could not be recorded.");
  }
  await appendAdminAudit({ actorId: context.user.id, actionKey: "trust.version_approved", targetType: "trust_document_version", targetId: version.id, requestId: id, metadata: { documentId: version.document_id } });
  revalidateTrust(null, version.document_id);
  return actionSuccess(undefined);
}

export async function publishTrustVersion(versionId: string) {
  const parsed = trustVersionIdSchema.safeParse(versionId);
  if (!parsed.success) return actionFailure("Invalid policy version.");
  const context = await requireAdmin({ ownerOnly: true });
  const id = await requestId();
  const admin = createUntypedClient();
  const { data: version } = await admin.from("trust_document_versions").select("id, document_id, document:trust_documents!trust_document_versions_document_id_fkey(slug)").eq("id", parsed.data).maybeSingle();
  if (!version) return actionFailure("The policy version could not be found.");
  const { error } = await admin.rpc("admin_publish_trust_version", { actor: context.user.id, target_version: version.id, audit_request_id: id });
  if (error) {
    logger.error("Trust publication failed", { requestId: id, actorId: context.user.id, versionId: version.id, error });
    return actionFailure(error.message?.includes("approved") ? "Approve the counsel-reviewed version before publication." : "The policy could not be published.");
  }
  const relation = (version as unknown as { document?: { slug?: string } | { slug?: string }[] }).document;
  const slug = Array.isArray(relation) ? relation[0]?.slug : relation?.slug;
  revalidateTrust(slug, version.document_id);
  return actionSuccess(undefined);
}

export async function rollbackTrustVersion(input: unknown) {
  const parsed = trustRollbackSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Choose a valid historical version and re-acceptance decision.");
  const context = await requireAdmin({ ownerOnly: true });
  const id = await requestId();
  const admin = createUntypedClient();
  const { data: version } = await admin.from("trust_document_versions").select("id, document_id, status, document:trust_documents!trust_document_versions_document_id_fkey(slug)").eq("id", parsed.data.versionId).maybeSingle();
  if (!version || !["published", "superseded"].includes(version.status)) return actionFailure("Only a historical published version can be restored.");
  const { error } = await admin.rpc("admin_rollback_trust_version", {
    actor: context.user.id,
    source_version_id: version.id,
    audit_request_id: id,
    require_reacceptance: parsed.data.requiresReacceptance,
  });
  if (error) {
    logger.error("Trust rollback failed", { requestId: id, actorId: context.user.id, versionId: version.id, error });
    return actionFailure("The historical policy version could not be restored.");
  }
  const relation = (version as unknown as { document?: { slug?: string } | { slug?: string }[] }).document;
  const slug = Array.isArray(relation) ? relation[0]?.slug : relation?.slug;
  revalidateTrust(slug, version.document_id);
  return actionSuccess(undefined);
}

export async function updatePrivacyRequest(input: unknown) {
  const parsed = privacyRequestAdminSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Check the request status and resolution details.", parsed.error.flatten());
  const context = await requireAdmin();
  const id = await requestId();
  const admin = createUntypedClient();
  const { data: request } = await admin.from("privacy_requests").select("id, request_type, user_id").eq("id", parsed.data.id).maybeSingle();
  if (!request) return actionFailure("The privacy request could not be found.");
  const closing = parsed.data.status === "completed" || parsed.data.status === "declined" || parsed.data.status === "cancelled";
  if (parsed.data.status === "completed" && request.request_type === "deletion") {
    if (context.membership.level !== "owner") return actionFailure("Only an owner can complete an account deletion.");
    const decision = parsed.data.retentionDecision;
    if (!decision.deleted || !decision.anonymized || !decision.retained) return actionFailure("Complete the deleted, anonymized, and retained-data checklist before closing a deletion request.");
    if (!request.user_id) return actionFailure("The account has already been removed.");
    try {
      await completeDeletionRequest({ actorId: context.user.id, userId: request.user_id, privacyRequestId: request.id, requestId: id });
    } catch (error) {
      logger.error("Privacy deletion execution failed", { requestId: id, actorId: context.user.id, privacyRequestId: request.id, error });
      return actionFailure("The account could not be deleted. Storage and session cleanup must complete before the request can close.");
    }
  }
  const { error } = await admin.from("privacy_requests").update({
    status: parsed.data.status,
    assigned_to: context.user.id,
    resolution_note: parsed.data.resolutionNote ?? null,
    retention_decision: parsed.data.retentionDecision,
    completed_at: closing ? new Date().toISOString() : null,
  }).eq("id", request.id);
  if (error) {
    logger.error("Privacy request update failed", { requestId: id, actorId: context.user.id, privacyRequestId: request.id, error });
    return actionFailure("The privacy request could not be updated.");
  }
  await appendAdminAudit({ actorId: context.user.id, actionKey: "privacy.request_updated", targetType: "privacy_request", targetId: request.id, requestId: id, metadata: { requestType: request.request_type, status: parsed.data.status } });
  revalidatePath("/admin/privacy-requests");
  revalidatePath(`/admin/privacy-requests/${request.id}`);
  revalidatePath("/settings");
  return actionSuccess(undefined);
}

export async function setListingReviewVerification(input: unknown) {
  const parsed = verificationCheckSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Record a valid listing and evidence note.", parsed.error.flatten());
  const context = await requireAdmin();
  const id = await requestId();
  const admin = createUntypedClient();
  const { data: listing } = await admin.from("listings").select("id").eq("id", parsed.data.listingId).maybeSingle();
  if (!listing) return actionFailure("The listing could not be found.");
  const { data: existing } = await admin.from("verification_checks").select("id").eq("listing_id", listing.id).eq("check_key", "listing_review").maybeSingle();
  const values = parsed.data.verified ? { status: "verified", public_label: "Listing reviewed", evidence_note: parsed.data.evidenceNote, reviewed_by: context.user.id, verified_at: new Date().toISOString(), revoked_at: null } : { status: "revoked", public_label: "Listing reviewed", evidence_note: parsed.data.evidenceNote, reviewed_by: context.user.id, revoked_at: new Date().toISOString() };
  const mutation = existing ? admin.from("verification_checks").update(values).eq("id", existing.id) : admin.from("verification_checks").insert({ listing_id: listing.id, check_key: "listing_review", ...values });
  const { error } = await mutation;
  if (error) {
    logger.error("Listing verification update failed", { requestId: id, actorId: context.user.id, listingId: listing.id, error });
    return actionFailure("The listing review signal could not be updated.");
  }
  await appendAdminAudit({ actorId: context.user.id, actionKey: parsed.data.verified ? "verification.listing_verified" : "verification.listing_revoked", targetType: "listing", targetId: listing.id, requestId: id });
  revalidatePath("/admin/verifications");
  revalidatePath(`/listing/${listing.id}`);
  revalidatePath("/");
  return actionSuccess(undefined);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  const lower = sorted[middle - 1] ?? upper;
  return sorted.length % 2 ? upper : Math.round((lower + upper) / 2);
}

export async function generateTransparencySnapshot(input: unknown) {
  const parsed = transparencyPeriodSchema.safeParse(input);
  if (!parsed.success || parsed.data.periodEnd < parsed.data.periodStart) return actionFailure("Choose a valid reporting period.");
  const context = await requireAdmin();
  const id = await requestId();
  const admin = createUntypedClient();
  const from = `${parsed.data.periodStart}T00:00:00.000Z`;
  const to = `${parsed.data.periodEnd}T23:59:59.999Z`;
  const [{ count: received }, { count: resolved }, { data: responseRows }, { count: fraudRemoved }, { count: restrictions }, { count: suspensions }] = await Promise.all([
    admin.from("moderation_cases").select("id", { count: "exact", head: true }).gte("created_at", from).lte("created_at", to),
    admin.from("moderation_cases").select("id", { count: "exact", head: true }).gte("resolved_at", from).lte("resolved_at", to).in("status", ["resolved", "dismissed"]),
    admin.from("moderation_cases").select("created_at, first_reviewed_at").gte("created_at", from).lte("created_at", to).not("first_reviewed_at", "is", null),
    admin.from("moderation_cases").select("id", { count: "exact", head: true }).eq("category", "fraud_or_scam").eq("status", "resolved").gte("resolved_at", from).lte("resolved_at", to),
    admin.from("listing_restrictions").select("id", { count: "exact", head: true }).gte("restricted_at", from).lte("restricted_at", to),
    admin.from("account_suspensions").select("id", { count: "exact", head: true }).gte("created_at", from).lte("created_at", to),
  ]);
  const responseMinutes = (responseRows ?? []).map((row) => Math.max(0, Math.round((new Date(row.first_reviewed_at).getTime() - new Date(row.created_at).getTime()) / 60_000)));
  const metrics = [
    { key: "reports_received", label: "Reports received", value: received ?? 0, sampleSize: received ?? 0 },
    { key: "reports_resolved", label: "Reports closed", value: resolved ?? 0, sampleSize: received ?? 0 },
    { key: "median_first_response", label: "Median first response", value: median(responseMinutes), unit: "minutes", sampleSize: responseMinutes.length },
    { key: "fraudulent_listings_removed", label: "Fraud reports resolved", value: fraudRemoved ?? 0, sampleSize: received ?? 0 },
    { key: "listing_restrictions", label: "Listings restricted", value: restrictions ?? 0, sampleSize: restrictions ?? 0 },
    { key: "account_suspensions", label: "Accounts suspended", value: suspensions ?? 0, sampleSize: suspensions ?? 0 },
  ];
  const { data: existing } = await admin.from("transparency_snapshots").select("id, status").eq("period_start", parsed.data.periodStart).eq("period_end", parsed.data.periodEnd).maybeSingle();
  if (existing?.status === "published") return actionFailure("A published snapshot is immutable. Generate the next reporting period instead.");
  const payload = { period_start: parsed.data.periodStart, period_end: parsed.data.periodEnd, metrics, minimum_group_size: 10, status: "draft", generated_by: context.user.id };
  const { data, error } = existing ? await admin.from("transparency_snapshots").update(payload).eq("id", existing.id).select("id").maybeSingle() : await admin.from("transparency_snapshots").insert(payload).select("id").maybeSingle();
  if (error || !data) return actionFailure("The transparency snapshot could not be generated.");
  await appendAdminAudit({ actorId: context.user.id, actionKey: "transparency.snapshot_generated", targetType: "transparency_snapshot", targetId: data.id, requestId: id, metadata: { periodStart: parsed.data.periodStart, periodEnd: parsed.data.periodEnd } });
  revalidatePath("/admin/transparency");
  return actionSuccess({ id: String(data.id) });
}

export async function publishTransparencySnapshot(snapshotId: string) {
  const parsed = trustVersionIdSchema.safeParse(snapshotId);
  if (!parsed.success) return actionFailure("Invalid transparency snapshot.");
  const context = await requireAdmin({ ownerOnly: true });
  const id = await requestId();
  const admin = createUntypedClient();
  const { data: snapshot } = await admin.from("transparency_snapshots").select("id, status").eq("id", parsed.data).maybeSingle();
  if (!snapshot || snapshot.status !== "draft") return actionFailure("Only a draft snapshot can be published.");
  await admin.from("transparency_snapshots").update({ status: "superseded" }).eq("status", "published").neq("id", snapshot.id);
  const { error } = await admin.from("transparency_snapshots").update({ status: "published", published_by: context.user.id, published_at: new Date().toISOString() }).eq("id", snapshot.id);
  if (error) return actionFailure("The transparency snapshot could not be published.");
  await appendAdminAudit({ actorId: context.user.id, actionKey: "transparency.snapshot_published", targetType: "transparency_snapshot", targetId: snapshot.id, requestId: id });
  revalidatePath("/admin/transparency");
  revalidatePath("/trust/transparency");
  return actionSuccess(undefined);
}
