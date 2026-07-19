import "server-only";

import { createUntypedClient } from "@/lib/supabase/admin";

import { suppressSmallTransparencyMetrics } from "./transparency";
import type { PolicyVersion, TransparencyMetric, TransparencySnapshot, TrustDocument, TrustDocumentCategory } from "./types";

type Row = Record<string, unknown>;

function mapDocument(row: Row): TrustDocument {
  return {
    id: String(row.id),
    slug: String(row.slug),
    category: String(row.category) as TrustDocumentCategory,
    title: String(row.title),
    summary: String(row.summary),
    currentVersionId: row.current_version_id ? String(row.current_version_id) : null,
  };
}

function mapVersion(row: Row): PolicyVersion {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    version: Number(row.version),
    status: row.status as PolicyVersion["status"],
    bodyMarkdown: String(row.body_markdown),
    changeSummary: String(row.change_summary ?? ""),
    requiresReacceptance: Boolean(row.requires_reacceptance),
    effectiveAt: row.effective_at ? String(row.effective_at) : null,
    externalReviewerName: row.external_reviewer_name ? String(row.external_reviewer_name) : null,
    counselReference: row.counsel_reference ? String(row.counsel_reference) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    createdAt: String(row.created_at),
  };
}

export async function listTrustDocuments() {
  const admin = createUntypedClient();
  const { data, error } = await admin
    .from("trust_documents")
    .select("id, slug, category, title, summary, current_version_id")
    .order("title");
  if (error) throw error;
  return (data ?? []).map((row) => mapDocument(row as Row));
}

export async function getPublishedTrustDocument(slug: string) {
  const admin = createUntypedClient();
  const { data: document, error } = await admin
    .from("trust_documents")
    .select("id, slug, category, title, summary, current_version_id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!document) return null;

  const { data: version, error: versionError } = await admin
    .from("trust_document_versions")
    .select("*")
    .eq("document_id", document.id)
    .eq("status", "published")
    .lte("effective_at", new Date().toISOString())
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) throw versionError;

  return {
    document: mapDocument(document as Row),
    version: version ? mapVersion(version as Row) : null,
  };
}

export async function getLatestTransparencySnapshot(): Promise<TransparencySnapshot | null> {
  const admin = createUntypedClient();
  const { data, error } = await admin
    .from("transparency_snapshots")
    .select("id, period_start, period_end, metrics, minimum_group_size, published_at")
    .eq("status", "published")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.published_at) return null;

  const rawMetrics = Array.isArray(data.metrics) ? data.metrics : [];
  const metrics = suppressSmallTransparencyMetrics(
    rawMetrics.filter((item): item is Omit<TransparencyMetric, "suppressed"> => Boolean(item && typeof item === "object" && "key" in item && "sampleSize" in item)),
    Number(data.minimum_group_size),
  );

  return {
    id: String(data.id),
    periodStart: String(data.period_start),
    periodEnd: String(data.period_end),
    minimumGroupSize: Number(data.minimum_group_size),
    publishedAt: String(data.published_at),
    metrics,
  };
}

export async function listAdminTrustDocuments() {
  const admin = createUntypedClient();
  const { data: documents, error } = await admin.from("trust_documents").select("*").order("title");
  if (error) throw error;
  const { data: versions, error: versionsError } = await admin.from("trust_document_versions").select("*").order("version", { ascending: false });
  if (versionsError) throw versionsError;
  return (documents ?? []).map((row) => ({
    document: mapDocument(row as Row),
    versions: (versions ?? []).filter((version) => version.document_id === row.id).map((version) => mapVersion(version as Row)),
  }));
}

export async function getAdminTrustDocument(id: string) {
  const rows = await listAdminTrustDocuments();
  return rows.find((item) => item.document.id === id) ?? null;
}

export async function listAdminPrivacyRequests() {
  const admin = createUntypedClient();
  const { data, error } = await admin.from("privacy_requests").select("*, profile:profiles(email, full_name)").order("due_at").limit(250);
  if (error) throw error;
  return data ?? [];
}

export async function getAdminPrivacyRequest(id: string) {
  const admin = createUntypedClient();
  const { data, error } = await admin.from("privacy_requests").select("*, profile:profiles(email, full_name)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listAdminVerificationChecks() {
  const admin = createUntypedClient();
  const { data, error } = await admin.from("verification_checks").select("*, profile:profiles(email, full_name), listing:listings(title, address)").order("updated_at", { ascending: false }).limit(250);
  if (error) throw error;
  return data ?? [];
}

export async function listAdminTransparencySnapshots() {
  const admin = createUntypedClient();
  const { data, error } = await admin.from("transparency_snapshots").select("*").order("period_end", { ascending: false }).limit(60);
  if (error) throw error;
  return data ?? [];
}
