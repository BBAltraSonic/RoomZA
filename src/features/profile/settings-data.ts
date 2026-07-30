import "server-only";

import { getPrivateProfileData } from "@/features/profile/data";
import { getAccountSecuritySettings } from "@/features/trust/account-security-data";
import { getTrustSettingsData } from "@/features/trust/settings-data";
import { requireUser } from "@/lib/auth";
import { createUntypedClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export const settingsSections = [
  "profile",
  "privacy",
  "notifications",
  "security",
  "connections",
  "account",
] as const;

export type SettingsSection = (typeof settingsSections)[number];

type BlockRow = Pick<
  Database["public"]["Tables"]["profile_blocks"]["Row"],
  "blocked_id" | "created_at"
>;
type MuteRow = Pick<
  Database["public"]["Tables"]["profile_mutes"]["Row"],
  "muted_id" | "created_at"
>;
type PublicNameRow = Pick<
  Database["public"]["Tables"]["public_profiles"]["Row"],
  "profile_id" | "username" | "display_name"
>;
type SubscriptionRow = Pick<
  Database["public"]["Tables"]["notification_subscriptions"]["Row"],
  "category" | "channel" | "enabled" | "frequency"
>;
type ConsentRow = Pick<
  Database["public"]["Tables"]["consent_events"]["Row"],
  "id" | "consent_key" | "granted" | "source" | "created_at"
>;
type VersionRow = Pick<
  Database["public"]["Tables"]["profile_versions"]["Row"],
  "id" | "version" | "changed_fields" | "created_at"
>;
type SecurityEventRow = Pick<
  Database["public"]["Tables"]["account_security_events"]["Row"],
  | "id"
  | "event_key"
  | "device_label"
  | "user_agent"
  | "is_suspicious"
  | "occurred_at"
>;
type RecognizedDeviceRow = Pick<
  Database["public"]["Tables"]["recognized_devices"]["Row"],
  "id" | "label" | "first_seen_at" | "last_seen_at" | "revoked_at"
>;

export async function getProfileSettingsData() {
  const { user } = await requireUser({ redirectTo: "/settings" });
  const admin = createUntypedClient();
  const [
    profile,
    security,
    trust,
    subscriptionsResult,
    blocksResult,
    mutesResult,
    consentResult,
    versionsResult,
    securityEventsResult,
    devicesResult,
  ] = await Promise.all([
    getPrivateProfileData(),
    getAccountSecuritySettings(user),
    getTrustSettingsData(user.id),
    admin
      .from("notification_subscriptions")
      .select("category,channel,enabled,frequency")
      .eq("user_id", user.id)
      .order("category"),
    admin
      .from("profile_blocks")
      .select("blocked_id,created_at")
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("profile_mutes")
      .select("muted_id,created_at")
      .eq("muter_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("consent_events")
      .select("id,consent_key,granted,source,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("profile_versions")
      .select("id,version,changed_fields,created_at")
      .eq("profile_id", user.id)
      .order("version", { ascending: false })
      .limit(25),
    admin
      .from("account_security_events")
      .select("id,event_key,device_label,user_agent,is_suspicious,occurred_at")
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(50),
    admin
      .from("recognized_devices")
      .select("id,label,first_seen_at,last_seen_at,revoked_at")
      .eq("user_id", user.id)
      .order("last_seen_at", { ascending: false }),
  ]);

  const blockRows = (blocksResult.data ?? []) as BlockRow[];
  const muteRows = (mutesResult.data ?? []) as MuteRow[];
  const relationshipIds = [
    ...blockRows.map((row) => row.blocked_id),
    ...muteRows.map((row) => row.muted_id),
  ];
  const { data: names } = relationshipIds.length
    ? await admin
        .from("public_profiles")
        .select("profile_id,username,display_name")
        .in("profile_id", relationshipIds)
    : { data: [] };
  const nameMap = new Map(
    ((names ?? []) as PublicNameRow[]).map((row) => [row.profile_id, row]),
  );

  return {
    profile,
    security,
    trust,
    subscriptions: (subscriptionsResult.data ?? []) as SubscriptionRow[],
    blocks: blockRows.map((row) => ({
      ...row,
      profile: nameMap.get(row.blocked_id) ?? null,
    })),
    mutes: muteRows.map((row) => ({
      ...row,
      profile: nameMap.get(row.muted_id) ?? null,
    })),
    consentHistory: (consentResult.data ?? []) as ConsentRow[],
    profileVersions: (versionsResult.data ?? []) as VersionRow[],
    securityEvents: (securityEventsResult.data ?? []) as SecurityEventRow[],
    recognizedDevices: (devicesResult.data ?? []) as RecognizedDeviceRow[],
  };
}
