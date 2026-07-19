"use server";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { enqueueNotificationEvent } from "@/features/notifications/outbox";
import { actionFailure, actionSuccess } from "@/lib/action-result";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createUntypedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { appendAdminAudit } from "./audit";
import { requireAdmin } from "./auth";
import {
  caseNoteSchema,
  caseUpdateSchema,
  listingRestrictionSchema,
  membershipSchema,
  nsfasAccreditationSchema,
  reportSchema,
  restoreAccountSchema,
  revokeMembershipSchema,
  sensitiveGrantSchema,
  suspensionSchema,
} from "./schemas";

async function requestId() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-request-id") ?? requestHeaders.get("cf-ray") ?? randomUUID();
}

async function notifyOwners(caseId: string, priority: string, category: string) {
  if (priority !== "high" && priority !== "urgent") return;
  const admin = createUntypedClient();
  const { data: owners } = await admin.from("admin_memberships").select("user_id").eq("level", "owner").is("revoked_at", null);
  for (const owner of owners ?? []) {
    const { data: event } = await admin.from("notification_events").insert({
      recipient_id: owner.user_id,
      type: "admin_alert",
      payload: { message: `A ${priority} priority ${category.replaceAll("_", " ")} report needs review.`, caseId },
      idempotency_key: `admin-case:${caseId}:${owner.user_id}`,
    }).select("id").maybeSingle();
    if (event?.id) await enqueueNotificationEvent(event.id);
  }
}

async function notifyUser(userId: string, message: string, idempotencyKey: string) {
  const admin = createUntypedClient();
  const { data: event, error } = await admin.from("notification_events").upsert({
    recipient_id: userId,
    type: "moderation_update",
    payload: { message },
    idempotency_key: idempotencyKey,
  }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) {
    logger.error("Moderation notification insert failed", { userId, idempotencyKey, error });
    return;
  }
  if (event?.id) await enqueueNotificationEvent(event.id);
}

export async function submitModerationReport(input: unknown) {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Fix the report details.", parsed.error.flatten());

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return actionFailure("Sign in to submit a report.");

  const limit = await consumeRateLimit({ key: `moderation-report:${user.id}`, requests: 5, window: "1 h" });
  if (!limit.success) return actionFailure("You have submitted several reports. Try again later.");

  const admin = createUntypedClient();
  const value = parsed.data;
  if (value.reportedUserId === user.id) return actionFailure("You cannot report your own account.");
  let targetContext: Record<string, string> = {};

  if (value.listingId) {
    const { data: listing } = await admin.from("listings").select("id, landlord_id").eq("id", value.listingId).maybeSingle();
    if (!listing) return actionFailure("That listing is no longer available.");
    if (listing.landlord_id === user.id) return actionFailure("You cannot report your own listing.");
  } else if (value.reportedUserId) {
    const { data: profile } = await admin.from("profiles").select("id").eq("id", value.reportedUserId).maybeSingle();
    if (!profile) return actionFailure("That account could not be found.");
  } else if (value.messageId) {
    const { data: message } = await admin.from("messages").select("id, sender_id, conversation_id").eq("id", value.messageId).maybeSingle();
    if (!message) return actionFailure("That message could not be found.");
    if (message.sender_id === user.id) return actionFailure("You cannot report your own message.");
    const { data: conversation } = await admin.from("conversations").select("id, renter_id, landlord_id, listing_id").eq("id", message.conversation_id).maybeSingle();
    if (!conversation || (conversation.renter_id !== user.id && conversation.landlord_id !== user.id)) return actionFailure("You cannot report a message outside your conversation.");
    targetContext = { conversationId: conversation.id, listingId: conversation.listing_id };
  } else if (value.listingImageId) {
    const { data: image } = await admin.from("listing_images").select("id, listing_id, listing:listings(landlord_id)").eq("id", value.listingImageId).maybeSingle();
    const listing = Array.isArray(image?.listing) ? image?.listing[0] : image?.listing;
    if (!image || !listing) return actionFailure("That listing photo could not be found.");
    if (listing.landlord_id === user.id) return actionFailure("You cannot report your own listing photo.");
    targetContext = { listingId: image.listing_id };
  }

  const priority = value.category === "fraud_or_scam" || value.category === "safety" ? "high" : "normal";
  const { data: moderationCase, error } = await admin.from("moderation_cases").insert({
    reporter_id: user.id,
    listing_id: value.listingId ?? null,
    reported_user_id: value.reportedUserId ?? null,
    message_id: value.messageId ?? null,
    listing_image_id: value.listingImageId ?? null,
    target_context: targetContext,
    category: value.category,
    details: value.details,
    priority,
  }).select("id").maybeSingle();

  if (error || !moderationCase) {
    if (error?.code === "23505") return actionFailure("You already have an open report for this item.");
    logger.error("Moderation report insert failed", { userId: user.id, error });
    return actionFailure("The report could not be submitted.");
  }

  await notifyOwners(moderationCase.id, priority, value.category);
  return actionSuccess({ caseId: moderationCase.id });
}

export async function updateModerationCase(input: unknown) {
  const parsed = caseUpdateSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Invalid case update.", parsed.error.flatten());
  const context = await requireAdmin();
  const id = await requestId();
  const admin = createUntypedClient();
  const resolved = parsed.data.status === "resolved" || parsed.data.status === "dismissed";
  const { data: priorCase } = await admin.from("moderation_cases").select("reporter_id, category").eq("id", parsed.data.caseId).maybeSingle();
  const { error } = await admin.rpc("admin_update_case", {
    actor: context.user.id,
    target_case: parsed.data.caseId,
    next_status: parsed.data.status,
    next_priority: parsed.data.priority,
    next_assignee: parsed.data.assignedTo ?? null,
    next_resolution: resolved ? parsed.data.resolutionNote ?? null : null,
    audit_request_id: id,
  });
  if (error) return actionFailure("The case could not be updated.");
  if (resolved && priorCase?.reporter_id) {
    await notifyUser(priorCase.reporter_id, "Your report has been reviewed. Thank you for helping keep Pinpoints safe.", `moderation-outcome:${parsed.data.caseId}:${parsed.data.status}`);
  }
  await notifyOwners(parsed.data.caseId, parsed.data.priority, priorCase?.category ?? "other");
  revalidatePath(`/admin/reports/${parsed.data.caseId}`);
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  return actionSuccess(undefined);
}

export async function addModerationCaseNote(input: unknown) {
  const parsed = caseNoteSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Enter a case note.");
  const context = await requireAdmin();
  const admin = createUntypedClient();
  const { error } = await admin.rpc("admin_add_case_note", { actor: context.user.id, target_case: parsed.data.caseId, note_body: parsed.data.body, audit_request_id: await requestId() });
  if (error) return actionFailure("The note could not be added.");
  revalidatePath(`/admin/reports/${parsed.data.caseId}`);
  return actionSuccess(undefined);
}

export async function suspendAccount(input: unknown) {
  const parsed = suspensionSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Enter a valid suspension reason and duration.");
  const context = await requireAdmin();
  if (parsed.data.userId === context.user.id) return actionFailure("You cannot suspend your own account.");

  const admin = createUntypedClient();
  const { data: targetMembership } = await admin.from("admin_memberships").select("level, revoked_at").eq("user_id", parsed.data.userId).maybeSingle();
  if (targetMembership && !targetMembership.revoked_at) return actionFailure("Revoke admin membership before suspending this account.");

  const hours = Number.parseInt(parsed.data.duration, 10);
  const suspendedUntil = parsed.data.duration === "876000h" ? null : new Date(Date.now() + hours * 3_600_000).toISOString();
  const suspensionRequestId = await requestId();
  const { error: restrictionError } = await admin.rpc("admin_set_account_restriction", {
    actor: context.user.id,
    target_user: parsed.data.userId,
    action_reason: parsed.data.reason,
    until_at: suspendedUntil,
    restore: false,
    audit_request_id: suspensionRequestId,
  });
  if (restrictionError) return actionFailure(restrictionError.code === "23505" ? "This account is already suspended." : "The account restriction could not be created.");

  const { error: authError } = await admin.auth.admin.updateUserById(parsed.data.userId, { ban_duration: parsed.data.duration });
  if (authError) {
    logger.error("Auth ban failed after account restriction", { userId: parsed.data.userId, actorId: context.user.id, error: authError });
    await appendAdminAudit({ actorId: context.user.id, actionKey: "user.suspension_auth_failed", targetType: "user", targetId: parsed.data.userId, requestId: suspensionRequestId });
    return actionFailure("Database access is blocked, but the Auth ban needs operator attention.");
  }
  await notifyUser(parsed.data.userId, `Your Pinpoints account has been suspended. Reason: ${parsed.data.reason}`, `account-suspended:${parsed.data.userId}:${suspensionRequestId}`);
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/users");
  return actionSuccess(undefined);
}

export async function restoreAccount(input: unknown) {
  const parsed = restoreAccountSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Enter a valid restoration reason.");
  const context = await requireAdmin();
  const admin = createUntypedClient();
  const { error: authError } = await admin.auth.admin.updateUserById(parsed.data.userId, { ban_duration: "none" });
  if (authError) return actionFailure("The Auth ban could not be removed, so database access remains blocked.");
  const { error } = await admin.rpc("admin_set_account_restriction", { actor: context.user.id, target_user: parsed.data.userId, action_reason: parsed.data.reason, until_at: null, restore: true, audit_request_id: await requestId() });
  if (error) return actionFailure("The account restriction could not be restored.");
  await notifyUser(parsed.data.userId, `Your Pinpoints account access has been restored. Reason: ${parsed.data.reason}`, `account-restored:${parsed.data.userId}:${Date.now()}`);
  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/users");
  return actionSuccess(undefined);
}

export async function restrictListing(input: unknown) {
  const parsed = listingRestrictionSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Enter a valid restriction reason.");
  const context = await requireAdmin();
  const admin = createUntypedClient();
  const { data: listing } = await admin.from("listings").select("landlord_id").eq("id", parsed.data.listingId).maybeSingle();
  const { error } = await admin.rpc("admin_set_listing_restriction", { actor: context.user.id, target_listing: parsed.data.listingId, action_reason: parsed.data.reason, restore: false, audit_request_id: await requestId() });
  if (error) return actionFailure(error.code === "23505" ? "This listing is already restricted." : "The listing could not be restricted.");
  if (listing?.landlord_id) await notifyUser(listing.landlord_id, `Your listing has been hidden from public discovery. Reason: ${parsed.data.reason}`, `listing-hidden:${parsed.data.listingId}`);
  revalidatePath(`/admin/listings/${parsed.data.listingId}`);
  revalidatePath("/admin/listings");
  revalidatePath("/listings");
  return actionSuccess(undefined);
}

export async function restoreListing(input: unknown) {
  const parsed = listingRestrictionSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Enter a valid restoration reason.");
  const context = await requireAdmin();
  const admin = createUntypedClient();
  const { data: listing } = await admin.from("listings").select("landlord_id").eq("id", parsed.data.listingId).maybeSingle();
  const { error } = await admin.rpc("admin_set_listing_restriction", { actor: context.user.id, target_listing: parsed.data.listingId, action_reason: parsed.data.reason, restore: true, audit_request_id: await requestId() });
  if (error) return actionFailure("The listing could not be restored.");
  if (listing?.landlord_id) await notifyUser(listing.landlord_id, `Your listing is visible in public discovery again. Reason: ${parsed.data.reason}`, `listing-restored:${parsed.data.listingId}:${Date.now()}`);
  revalidatePath(`/admin/listings/${parsed.data.listingId}`);
  revalidatePath("/admin/listings");
  revalidatePath("/listings");
  return actionSuccess(undefined);
}

export async function setNsfasAccreditation(input: unknown) {
  const parsed = nsfasAccreditationSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Enter a valid accreditation reason.");
  const context = await requireAdmin();
  const admin = createUntypedClient();
  const accreditationRequestId = await requestId();
  const { error } = await admin.rpc("admin_set_nsfas_accreditation", {
    actor: context.user.id,
    target_listing: parsed.data.listingId,
    approved: parsed.data.approved,
    action_reason: parsed.data.reason,
    audit_request_id: accreditationRequestId,
  });
  if (error) return actionFailure("The NSFAS accreditation could not be updated.");
  revalidatePath(`/admin/listings/${parsed.data.listingId}`);
  revalidatePath("/admin/listings");
  revalidatePath("/");
  return actionSuccess(undefined);
}

export async function retryNotification(eventId: string) {
  const context = await requireAdmin();
  const admin = createUntypedClient();
  const retryRequestId = await requestId();
  const { data: retriedEventId, error } = await admin.rpc("admin_retry_notification", { actor: context.user.id, target_event: eventId, audit_request_id: retryRequestId });
  if (error || !retriedEventId) return actionFailure("This notification is no longer retryable.");
  await enqueueNotificationEvent(retriedEventId, retryRequestId);
  revalidatePath("/admin/operations");
  return actionSuccess(undefined);
}

export async function inviteOrPromoteAdmin(input: unknown) {
  const parsed = membershipSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Enter a valid email and access level.");
  const context = await requireAdmin({ ownerOnly: true });
  const admin = createUntypedClient();
  let target = null;
  for (let page = 1; page <= 10 && !target; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return actionFailure("Users could not be searched.");
    target = data.users.find((user) => user.email?.toLowerCase() === parsed.data.email.toLowerCase()) ?? null;
    if (!data.nextPage) break;
  }

  if (!target) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent("/admin")}` });
    if (error || !data.user) return actionFailure("The admin invitation could not be sent.");
    target = data.user;
  } else if (!target.email_confirmed_at) {
    return actionFailure("The existing account must verify its email before promotion.");
  }

  const { error } = await admin.rpc("admin_set_membership", { actor: context.user.id, target_user: target.id, next_level: parsed.data.level, revoke: false, action_reason: "Owner membership change", audit_request_id: await requestId() });
  if (error) return actionFailure("Admin membership could not be saved.");
  revalidatePath("/admin/settings/admins");
  return actionSuccess({ userId: target.id });
}

export async function revokeAdminMembership(input: unknown) {
  const parsed = revokeMembershipSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Enter a valid revocation reason.");
  const context = await requireAdmin({ ownerOnly: true });
  if (parsed.data.userId === context.user.id) return actionFailure("You cannot revoke your own membership from the console.");
  const admin = createUntypedClient();
  const { error } = await admin.rpc("admin_set_membership", { actor: context.user.id, target_user: parsed.data.userId, next_level: "admin", revoke: true, action_reason: parsed.data.reason, audit_request_id: await requestId() });
  if (error) return actionFailure("Membership could not be revoked.");
  revalidatePath("/admin/settings/admins");
  return actionSuccess(undefined);
}

export async function resetAdminMfa(userId: string, factorId: string, reason: string) {
  const context = await requireAdmin({ ownerOnly: true });
  if (reason.trim().length < 10) return actionFailure("Enter a reset reason.");
  if (userId === context.user.id) return actionFailure("Use the trusted recovery command for the owner account.");
  const admin = createUntypedClient();
  const { error } = await admin.auth.admin.mfa.deleteFactor({ userId, id: factorId });
  if (error) return actionFailure("The MFA factor could not be reset.");
  await appendAdminAudit({ actorId: context.user.id, actionKey: "mfa.factor_reset", targetType: "user", targetId: userId, reason, requestId: await requestId(), metadata: { factorId } });
  return actionSuccess(undefined);
}

export async function createSensitiveAccessGrant(input: unknown) {
  const parsed = sensitiveGrantSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Enter a valid case-bound access reason.");
  const context = await requireAdmin();
  const admin = createUntypedClient();
  const { data: moderationCase } = await admin.from("moderation_cases").select("id, status, listing_id, reported_user_id").eq("id", parsed.data.caseId).maybeSingle();
  if (!moderationCase || !["open", "in_review"].includes(moderationCase.status)) return actionFailure("Sensitive access requires an active case.");

  let related = false;
  if (parsed.data.resourceType === "conversation") {
    const { data } = await admin.from("conversations").select("listing_id, renter_id, landlord_id").eq("id", parsed.data.resourceId).maybeSingle();
    related = Boolean(data && (data.listing_id === moderationCase.listing_id || data.renter_id === moderationCase.reported_user_id || data.landlord_id === moderationCase.reported_user_id));
  } else {
    const { data } = await admin.from("documents").select("application:applications(listing_id, renter_id)").eq("id", parsed.data.resourceId).maybeSingle();
    const application = Array.isArray(data?.application) ? data.application[0] : data?.application;
    related = Boolean(application && (application.listing_id === moderationCase.listing_id || application.renter_id === moderationCase.reported_user_id));
  }
  if (!related) return actionFailure("That resource is not related to this case.");

  const { data: grantRows, error } = await admin.rpc("admin_create_sensitive_grant", {
    actor: context.user.id,
    target_case: parsed.data.caseId,
    target_resource_type: parsed.data.resourceType,
    target_resource: parsed.data.resourceId,
    action_reason: parsed.data.reason,
    audit_request_id: await requestId(),
  });
  const grant = grantRows?.[0];
  if (error || !grant) return actionFailure("Sensitive access could not be granted.");
  revalidatePath(`/admin/reports/${parsed.data.caseId}`);
  return actionSuccess(grant);
}
