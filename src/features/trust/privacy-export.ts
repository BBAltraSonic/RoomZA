import "server-only";

import JSZip from "jszip";

import { logger } from "@/lib/logger";
import { createUntypedClient } from "@/lib/supabase/admin";

const EXPORT_BUCKET = "privacy-exports";
const EXPORT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_EXPORT_BYTES = 140 * 1024 * 1024;

type ExportRequest = { id: string; user_id: string };
type StoredFile = { bucket: string; path: string; archivePath: string };

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

async function addStoredFiles(zip: JSZip, files: StoredFile[], requestId: string, userId: string) {
  const admin = createUntypedClient();
  let totalBytes = 0;
  for (const file of files) {
    const { data, error } = await admin.storage.from(file.bucket).download(file.path);
    if (error || !data) {
      logger.warn("Privacy export file unavailable", { requestId, userId, bucket: file.bucket, error });
      continue;
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_EXPORT_BYTES) throw new Error("export_size_limit");
    zip.file(file.archivePath, bytes);
  }
}

export async function buildPrivacyExportArchive(userId: string, requestId: string) {
  const admin = createUntypedClient();
  const [profileResult, listingsResult, applicationsResult, conversationsResult, messagesResult, favoritesResult, alertsResult, notificationsResult, consentResult, acceptanceResult, reportsResult] = await Promise.all([
    admin.from("profiles").select("id, email, full_name, phone, phone_verified, email_verified_at, avatar_url, role, created_at, updated_at").eq("id", userId).maybeSingle(),
    admin.from("listings").select("*").eq("landlord_id", userId).order("created_at"),
    admin.from("applications").select("*").eq("renter_id", userId).order("created_at"),
    admin.from("conversations").select("id, listing_id, renter_id, landlord_id, application_id, type, created_at").or(`renter_id.eq.${userId},landlord_id.eq.${userId}`).order("created_at"),
    admin.from("messages").select("id, conversation_id, sender_id, listing_id, content, created_at").eq("sender_id", userId).order("created_at"),
    admin.from("user_favorites").select("*").eq("user_id", userId).order("created_at"),
    admin.from("search_alerts").select("*").eq("user_id", userId).order("created_at"),
    admin.from("notification_events").select("id, type, payload, sent_at, digest_at, created_at").eq("recipient_id", userId).order("created_at"),
    admin.from("consent_events").select("consent_key, granted, source, created_at").eq("user_id", userId).order("created_at"),
    admin.from("policy_acceptances").select("accepted_at, source, version:trust_document_versions(version, document:trust_documents(title, slug))").eq("user_id", userId).order("accepted_at"),
    admin.from("moderation_cases").select("id, category, status, created_at, updated_at, resolved_at, listing_id, reported_user_id, message_id, listing_image_id").eq("reporter_id", userId).order("created_at"),
  ]);
  const failures = [profileResult, listingsResult, applicationsResult, conversationsResult, messagesResult, favoritesResult, alertsResult, notificationsResult, consentResult, acceptanceResult, reportsResult].filter((result) => result.error);
  if (failures.length) throw new Error("export_query_failed");

  const listings = listingsResult.data ?? [];
  const applications = applicationsResult.data ?? [];
  const listingIds = listings.map((row) => row.id);
  const applicationIds = applications.map((row) => row.id);
  const [{ data: listingImages }, { data: documents }, { data: viewings }, { data: purchaseProgress }, { data: buyerInterests }] = await Promise.all([
    listingIds.length ? admin.from("listing_images").select("id, listing_id, bucket, path, public_url, sort_order, created_at").in("listing_id", listingIds).order("sort_order") : Promise.resolve({ data: [], error: null }),
    applicationIds.length ? admin.from("documents").select("id, application_id, type, bucket, path, file_url, mime_type, byte_size, created_at").in("application_id", applicationIds).order("created_at") : Promise.resolve({ data: [], error: null }),
    applicationIds.length ? admin.from("viewings").select("*, slot:viewing_slots(*)").in("application_id", applicationIds).order("created_at") : Promise.resolve({ data: [], error: null }),
    admin.from("purchase_progress").select("*").eq("user_id", userId).order("updated_at"),
    admin.from("buyer_interests").select("*").eq("buyer_id", userId).order("created_at"),
  ]);

  const archiveData = {
    generatedAt: new Date().toISOString(),
    profile: profileResult.data,
    listings,
    listingImages: listingImages ?? [],
    applications,
    applicationDocuments: documents ?? [],
    conversations: conversationsResult.data ?? [],
    sentMessages: messagesResult.data ?? [],
    viewings: viewings ?? [],
    savedListings: favoritesResult.data ?? [],
    searchAlerts: alertsResult.data ?? [],
    notifications: notificationsResult.data ?? [],
    consentHistory: consentResult.data ?? [],
    policyAcceptances: acceptanceResult.data ?? [],
    reports: reportsResult.data ?? [],
    purchaseProgress: purchaseProgress ?? [],
    buyerInterests: buyerInterests ?? [],
  };

  const zip = new JSZip();
  zip.file("pinpoint-data.json", JSON.stringify(archiveData, null, 2));
  zip.file("README.txt", "This archive contains personal information associated with your Pinpoint account. Store it securely. Files may be omitted if they were already deleted or unavailable when the archive was prepared.\n");
  const storedFiles: StoredFile[] = [
    ...(listingImages ?? []).filter((file) => file.bucket && file.path).map((file) => ({ bucket: String(file.bucket), path: String(file.path), archivePath: `files/listing-images/${safeSegment(String(file.id))}-${safeSegment(String(file.path).split("/").pop() ?? "image")}` })),
    ...(documents ?? []).filter((file) => file.bucket && file.path).map((file) => ({ bucket: String(file.bucket), path: String(file.path), archivePath: `files/application-documents/${safeSegment(String(file.id))}-${safeSegment(String(file.path).split("/").pop() ?? "document")}` })),
  ];
  await addStoredFiles(zip, storedFiles, requestId, userId);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

async function purgeExpiredExports(requestId: string) {
  const admin = createUntypedClient();
  const { data, error } = await admin.from("privacy_requests").select("id, artifact_path").eq("request_type", "export").lt("artifact_expires_at", new Date().toISOString()).not("artifact_path", "is", null).limit(100);
  if (error) {
    logger.warn("Expired privacy export lookup failed", { requestId, error });
    return;
  }
  const paths = (data ?? []).map((row) => String(row.artifact_path));
  if (paths.length) await admin.storage.from(EXPORT_BUCKET).remove(paths);
  if (data?.length) await admin.from("privacy_requests").update({ artifact_bucket: null, artifact_path: null, artifact_expires_at: null }).in("id", data.map((row) => row.id));
}

export async function processNextPrivacyExport(requestId: string) {
  await purgeExpiredExports(requestId);
  const admin = createUntypedClient();
  const { data: queued, error: queueError } = await admin.from("privacy_requests").select("id, user_id").eq("request_type", "export").eq("status", "submitted").order("created_at").limit(1).maybeSingle();
  if (queueError) return { success: false as const, code: "queue_failed", message: "Export queue could not be read.", httpStatus: 500 };
  if (!queued?.user_id) return { success: true as const, processed: 0 };
  const { data: claimed } = await admin.from("privacy_requests").update({ status: "in_review", error_code: null }).eq("id", queued.id).eq("status", "submitted").select("id, user_id").maybeSingle();
  if (!claimed?.user_id) return { success: true as const, processed: 0 };
  const request = claimed as ExportRequest;

  try {
    const archive = await buildPrivacyExportArchive(request.user_id, requestId);
    const path = `${request.user_id}/${request.id}.zip`;
    const { error: uploadError } = await admin.storage.from(EXPORT_BUCKET).upload(path, archive, { contentType: "application/zip", upsert: true });
    if (uploadError) throw uploadError;
    const expiresAt = new Date(Date.now() + EXPORT_LIFETIME_MS).toISOString();
    const { error: updateError } = await admin.from("privacy_requests").update({ status: "completed", completed_at: new Date().toISOString(), artifact_bucket: EXPORT_BUCKET, artifact_path: path, artifact_expires_at: expiresAt, resolution_note: "Self-service export prepared." }).eq("id", request.id);
    if (updateError) throw updateError;
    logger.info("Privacy export completed", { requestId, userId: request.user_id, privacyRequestId: request.id, archiveBytes: archive.byteLength });
    return { success: true as const, processed: 1 };
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 80) : "export_failed";
    await admin.from("privacy_requests").update({ status: "waiting_on_user", error_code: code }).eq("id", request.id);
    logger.error("Privacy export processing failed", { requestId, userId: request.user_id, privacyRequestId: request.id, error });
    return { success: false as const, code: "export_failed", message: "The export could not be prepared.", httpStatus: 500 };
  }
}
