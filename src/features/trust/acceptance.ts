import "server-only";

import { logger } from "@/lib/logger";
import { createUntypedClient } from "@/lib/supabase/admin";

export async function recordCurrentPolicyAcceptances(userId: string, source: "signup" | "reacceptance" | "settings", requestId?: string) {
  const admin = createUntypedClient();
  const { data: documents, error } = await admin.from("trust_documents").select("id, slug, current_version_id").in("slug", ["privacy", "terms"]);
  if (error) throw error;
  const rows = (documents ?? []).filter((document) => document.current_version_id).map((document) => ({ user_id: userId, document_id: document.id, version_id: document.current_version_id, source }));
  if (!rows.length) return;
  const { error: insertError } = await admin.from("policy_acceptances").upsert(rows, { onConflict: "user_id,version_id", ignoreDuplicates: true });
  if (insertError) {
    logger.error("Policy acceptance recording failed", { requestId, userId, source, acceptanceCount: rows.length, error: insertError });
    throw insertError;
  }
}

export async function recordPolicyVersionAcceptances(userId: string, versionIds: string[], source: "reacceptance" | "settings", requestId?: string) {
  if (!versionIds.length) return;
  const admin = createUntypedClient();
  const { data: versions, error } = await admin
    .from("trust_document_versions")
    .select("id, document_id")
    .in("id", versionIds)
    .eq("status", "published");
  if (error) throw error;
  const rows = (versions ?? []).map((version) => ({
    user_id: userId,
    document_id: version.document_id,
    version_id: version.id,
    source,
  }));
  if (!rows.length) return;
  const { error: insertError } = await admin.from("policy_acceptances").upsert(rows, { onConflict: "user_id,version_id", ignoreDuplicates: true });
  if (insertError) {
    logger.error("Material policy acceptance recording failed", { requestId, userId, source, acceptanceCount: rows.length, error: insertError });
    throw insertError;
  }
}

export async function recordSignupMarketingChoice(userId: string, granted: boolean, requestId?: string) {
  const admin = createUntypedClient();
  const [{ error: consentError }, { error: preferenceError }] = await Promise.all([
    admin.from("consent_events").insert({ user_id: userId, consent_key: "marketing", granted, source: "signup" }),
    admin.from("notification_preferences").upsert({ user_id: userId, marketing: granted }, { onConflict: "user_id" }),
  ]);
  if (consentError || preferenceError) logger.warn("Signup marketing choice persistence incomplete", { requestId, userId, consentError, preferenceError });
}

export async function getRequiredPolicyVersions(userId: string) {
  const admin = createUntypedClient();
  const { data: versions, error } = await admin.from("trust_document_versions").select("id, document_id, version, document:trust_documents(title, slug, current_version_id)").eq("status", "published").eq("requires_reacceptance", true).lte("effective_at", new Date().toISOString());
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }
  const current = (versions ?? []).filter((version) => { const document = Array.isArray(version.document) ? version.document[0] : version.document; return document?.current_version_id === version.id; });
  if (!current.length) return [];
  const { data: acceptances, error: acceptanceError } = await admin.from("policy_acceptances").select("version_id").eq("user_id", userId).in("version_id", current.map((version) => version.id));
  if (acceptanceError) {
    if (acceptanceError.code === "42P01" || acceptanceError.code === "PGRST205") return [];
    throw acceptanceError;
  }
  const accepted = new Set((acceptances ?? []).map((item) => item.version_id));
  return current.filter((version) => !accepted.has(version.id));
}
