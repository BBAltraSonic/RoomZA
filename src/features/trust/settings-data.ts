import "server-only";

import { createUntypedClient } from "@/lib/supabase/admin";

import type { PrivacyRequest, PrivacyRequestStatus, PrivacyRequestType } from "./types";

type Row = Record<string, unknown>;

export type NotificationPreferences = {
  applicationUpdates: boolean;
  viewingUpdates: boolean;
  messageDigest: boolean;
  searchAlerts: boolean;
  marketing: boolean;
  locationPersonalization: boolean;
  digestFrequency: "never" | "daily" | "weekly";
};

export const defaultNotificationPreferences: NotificationPreferences = {
  applicationUpdates: true,
  viewingUpdates: true,
  messageDigest: true,
  searchAlerts: true,
  marketing: false,
  locationPersonalization: false,
  digestFrequency: "daily",
};

function mapPreferences(row: Row | null): NotificationPreferences {
  if (!row) return defaultNotificationPreferences;
  return {
    applicationUpdates: Boolean(row.application_updates),
    viewingUpdates: Boolean(row.viewing_updates),
    messageDigest: Boolean(row.message_digest),
    searchAlerts: Boolean(row.search_alerts),
    marketing: Boolean(row.marketing),
    locationPersonalization: Boolean(row.location_personalization),
    digestFrequency: row.digest_frequency === "never" || row.digest_frequency === "weekly" ? row.digest_frequency : "daily",
  };
}

function mapRequest(row: Row): PrivacyRequest {
  return {
    id: String(row.id),
    requestType: row.request_type as PrivacyRequestType,
    status: row.status as PrivacyRequestStatus,
    details: String(row.details ?? ""),
    dueAt: String(row.due_at),
    artifactExpiresAt: row.artifact_expires_at ? String(row.artifact_expires_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getTrustSettingsData(userId: string) {
  const admin = createUntypedClient();
  const [{ data: preferences }, { data: requests }, { data: reports }, { data: acceptances }] = await Promise.all([
    admin.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("privacy_requests").select("id, request_type, status, details, due_at, artifact_expires_at, created_at, updated_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    admin.from("moderation_cases").select("id, category, status, created_at, updated_at, listing_id, reported_user_id, message_id, listing_image_id").eq("reporter_id", userId).order("created_at", { ascending: false }).limit(50),
    admin.from("policy_acceptances").select("id, accepted_at, source, version:trust_document_versions(version, document:trust_documents(title, slug))").eq("user_id", userId).order("accepted_at", { ascending: false }),
  ]);

  return {
    preferences: mapPreferences((preferences as Row | null) ?? null),
    privacyRequests: (requests ?? []).map((row) => mapRequest(row as Row)),
    reports: (reports ?? []).map((row) => ({
      id: String(row.id),
      category: String(row.category),
      status: String(row.status),
      targetKind: row.message_id ? "Message" : row.listing_image_id ? "Listing photo" : row.listing_id ? "Listing" : "Profile",
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })),
    acceptances: acceptances ?? [],
  };
}
