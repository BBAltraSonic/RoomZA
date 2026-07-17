"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { actionFailure, actionSuccess } from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createUntypedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { notificationPreferencesSchema, privacyRequestInputSchema } from "./schemas";
import { getRequiredPolicyVersions, recordPolicyVersionAcceptances } from "./acceptance";

async function requestId() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-request-id") ?? requestHeaders.get("cf-ray") ?? randomUUID();
}

export async function updateNotificationPreferences(input: unknown) {
  const parsed = notificationPreferencesSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Check the notification and privacy choices.", parsed.error.flatten());
  const { user } = await requireUser({ redirectTo: "/settings" });
  const id = await requestId();
  const admin = createUntypedClient();
  const { data: prior } = await admin.from("notification_preferences").select("marketing, location_personalization").eq("user_id", user.id).maybeSingle();
  const value = parsed.data;
  const { error } = await admin.from("notification_preferences").upsert({
    user_id: user.id,
    application_updates: true,
    viewing_updates: true,
    message_digest: value.messageDigest,
    search_alerts: value.searchAlerts,
    marketing: value.marketing,
    location_personalization: value.locationPersonalization,
    digest_frequency: value.digestFrequency,
  }, { onConflict: "user_id" });
  if (error) {
    logger.error("Trust preferences update failed", { requestId: id, userId: user.id, error });
    return actionFailure("Your preferences could not be saved.");
  }

  const consentRows = [];
  if (Boolean(prior?.marketing) !== value.marketing) consentRows.push({ user_id: user.id, consent_key: "marketing", granted: value.marketing, source: "settings" });
  if (Boolean(prior?.location_personalization) !== value.locationPersonalization) consentRows.push({ user_id: user.id, consent_key: "location_personalization", granted: value.locationPersonalization, source: "settings" });
  if (consentRows.length) {
    const { error: consentError } = await admin.from("consent_events").insert(consentRows);
    if (consentError) logger.warn("Consent history append failed", { requestId: id, userId: user.id, eventCount: consentRows.length, error: consentError });
  }
  revalidatePath("/settings");
  return actionSuccess(undefined);
}

export async function requestDataExport() {
  const { user } = await requireUser({ redirectTo: "/settings" });
  const limit = await consumeRateLimit({ key: `privacy-export:${user.id}`, requests: 2, window: "24 h" });
  if (!limit.success) return actionFailure("You can request another export after the current daily limit resets.");
  const id = await requestId();
  const admin = createUntypedClient();
  const { data, error } = await admin.from("privacy_requests").insert({ user_id: user.id, request_type: "export", details: "Self-service account data export." }).select("id").maybeSingle();
  if (error || !data) {
    if (error?.code === "23505") return actionFailure("An export is already being prepared.");
    logger.error("Privacy export request failed", { requestId: id, userId: user.id, error });
    return actionFailure("The export request could not be created.");
  }
  logger.info("Privacy export requested", { requestId: id, userId: user.id, privacyRequestId: data.id });
  revalidatePath("/settings");
  return actionSuccess({ id: String(data.id) });
}

export async function submitPrivacyRequest(input: unknown) {
  const parsed = privacyRequestInputSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Add enough detail for the privacy team to act on the request.", parsed.error.flatten());
  const { user } = await requireUser({ redirectTo: "/settings" });
  const limit = await consumeRateLimit({ key: `privacy-request:${user.id}`, requests: 5, window: "24 h" });
  if (!limit.success) return actionFailure("You have submitted several privacy requests. Try again tomorrow.");
  const id = await requestId();
  const admin = createUntypedClient();
  const { data, error } = await admin.from("privacy_requests").insert({ user_id: user.id, request_type: parsed.data.requestType, details: parsed.data.details }).select("id").maybeSingle();
  if (error || !data) {
    if (error?.code === "23505") return actionFailure("A request of this type is already open.");
    logger.error("Privacy request submission failed", { requestId: id, userId: user.id, requestType: parsed.data.requestType, error });
    return actionFailure("The privacy request could not be submitted.");
  }
  logger.info("Privacy request submitted", { requestId: id, userId: user.id, privacyRequestId: data.id, requestType: parsed.data.requestType });
  revalidatePath("/settings");
  return actionSuccess({ id: String(data.id) });
}

export async function cancelPrivacyRequest(requestIdValue: string) {
  const parsed = z.string().uuid().safeParse(requestIdValue);
  if (!parsed.success) return actionFailure("Invalid privacy request.");
  const { user } = await requireUser({ redirectTo: "/settings" });
  const id = await requestId();
  const admin = createUntypedClient();
  const { data, error } = await admin.from("privacy_requests").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", parsed.data).eq("user_id", user.id).in("status", ["submitted", "waiting_on_user"]).select("id").maybeSingle();
  if (error || !data) return actionFailure("Only a submitted request can be cancelled.");
  logger.info("Privacy request cancelled", { requestId: id, userId: user.id, privacyRequestId: data.id });
  revalidatePath("/settings");
  return actionSuccess(undefined);
}

export async function signOutOtherSessions() {
  await requireUser({ redirectTo: "/settings" });
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  return error ? actionFailure("Other sessions could not be signed out.") : actionSuccess(undefined);
}

export async function signOutEverywhere() {
  await requireUser({ redirectTo: "/settings" });
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/auth");
}

export async function acceptRequiredPolicies() {
  const { user } = await requireUser({ redirectTo: "/policy-acceptance" });
  const id = await requestId();
  try {
    const required = await getRequiredPolicyVersions(user.id);
    await recordPolicyVersionAcceptances(user.id, required.map((version) => String(version.id)), "reacceptance", id);
  } catch {
    redirect("/policy-acceptance?error=recording");
  }
  redirect("/");
}
