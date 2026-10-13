"use server";

import { createHash, randomUUID } from "node:crypto";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import {
  actionFailure,
  actionSuccess,
  fieldErrorFailure,
} from "@/lib/action-result";
import { requireUser } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { isMarketplacePersona } from "@/lib/personas";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createUntypedClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import {
  addPersonaSchema,
  contactProfileSchema,
  notificationPreferenceSchema,
  personaDetailsSchema,
  profilePrivacySchema,
  publicIdentitySchema,
  reviewSchema,
  updateProfileSchema,
} from "./schema";
import {
  ProfileUpdateTimeoutError,
  withProfileUpdateTimeout,
} from "./update-timeout";

export type ProfileActionState = {
  success: boolean;
  message: string;
};

/**
 * Server action: update the user's profile phone number.
 * Domain logic extracted from `src/app/profile/actions.ts` (R2.1).
 */
export async function updateProfileAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  try {
    const { user, profile } = await requireUser();

    if (!profile) {
      return {
        success: false,
        message: "Profile not fully loaded. Try again.",
      };
    }

    const parsed = updateProfileSchema.safeParse({
      phone: formData.get("phone"),
    });

    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.errors[0]?.message || "Invalid input",
      };
    }

    const newPhone = parsed.data.phone;

    if (newPhone === profile.phone) {
      return {
        success: true,
        message: "Profile updated successfully.",
      };
    }

    const supabase = await createClient();
    let updateError: unknown = null;
    try {
      const { error } = await withProfileUpdateTimeout(
        supabase
          .from("profiles")
          .update({
            phone: newPhone,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id),
      );
      updateError = error;
    } catch (error) {
      updateError = error;
    }

    if (updateError) {
      logger.error("Failed to update profile phone", {
        userId: user.id,
        error:
          updateError instanceof Error
            ? updateError.message
            : String(updateError),
      });
      return {
        success: false,
        message:
          updateError instanceof ProfileUpdateTimeoutError
            ? "Profile update could not be confirmed within 2 seconds."
            : "Failed to update profile. Please try again.",
      };
    }

    revalidatePath("/profile");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: "Profile updated successfully.",
    };
  } catch (error) {
    logger.error("Unexpected error updating profile", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    };
  }
}

function revalidateProfileRoutes(username?: string) {
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  revalidatePath("/settings", "layout");
  if (username) revalidatePath(`/u/${username}`);
  revalidateTag("public-profiles", "max");
}

async function appendActivity(
  profileId: string,
  event: {
    category: string;
    eventKey: string;
    title: string;
    summary?: string;
  },
) {
  const admin = createUntypedClient();
  await admin.from("profile_activity_events").insert({
    profile_id: profileId,
    category: event.category,
    event_key: event.eventKey,
    title: event.title,
    summary: event.summary,
  });
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

async function sensitiveSessionIsFresh() {
  const supabase = await createClient();
  const [{ data: aal }, { data: userData }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.getUser(),
  ]);
  if (aal?.currentLevel === "aal2") return true;
  const lastSignIn = userData.user?.last_sign_in_at;
  return Boolean(
    lastSignIn && Date.now() - new Date(lastSignIn).getTime() <= 15 * 60 * 1000,
  );
}

export async function updatePublicIdentityAction(input: unknown) {
  const parsed = publicIdentitySchema.safeParse(input);
  if (!parsed.success)
    return fieldErrorFailure(parsed.error.flatten().fieldErrors);
  const { user } = await requireUser({ redirectTo: "/profile/edit" });
  const admin = createUntypedClient();
  const { data: previous } = await admin
    .from("public_profiles")
    .select("*")
    .eq("profile_id", user.id)
    .single();
  if (!previous)
    return actionFailure("Your public identity is not initialized.");

  if (
    previous.username !== parsed.data.username &&
    !(await sensitiveSessionIsFresh())
  ) {
    return actionFailure(
      "Confirm your sign-in again before changing your username.",
    );
  }

  const { count } = await admin
    .from("profile_versions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);
  const { error: versionError } = await admin.from("profile_versions").insert({
    profile_id: user.id,
    version: (count ?? 0) + 1,
    public_snapshot: previous,
    persona_snapshot: {},
    changed_fields: Object.keys(parsed.data).filter((key) => {
      const databaseKey = key.replace(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`,
      );
      return (
        previous[databaseKey] !== parsed.data[key as keyof typeof parsed.data]
      );
    }),
    created_by: user.id,
  });
  if (versionError)
    logger.warn("Profile version append failed", {
      userId: user.id,
      error: versionError,
    });

  const { error } = await admin
    .from("public_profiles")
    .update({
      username: parsed.data.username,
      display_name: parsed.data.displayName,
      avatar_url: parsed.data.avatarUrl,
      bio: parsed.data.bio,
      languages: parsed.data.languages,
    })
    .eq("profile_id", user.id);
  if (error) {
    if (error.code === "23505") {
      return fieldErrorFailure({
        username: ["That username is already taken."],
      });
    }
    logger.error("Public identity update failed", { userId: user.id, error });
    return actionFailure("Your profile changes could not be saved.");
  }

  await appendActivity(user.id, {
    category: "profile",
    eventKey: "profile.updated",
    title: "Profile updated",
  });
  revalidateProfileRoutes(parsed.data.username);
  return actionSuccess({ username: parsed.data.username });
}

export async function updateProfilePrivacyAction(input: unknown) {
  const parsed = profilePrivacySchema.safeParse(input);
  if (!parsed.success)
    return fieldErrorFailure(parsed.error.flatten().fieldErrors);
  const { user } = await requireUser({ redirectTo: "/settings/privacy" });
  const admin = createUntypedClient();
  const { data: current } = await admin
    .from("public_profiles")
    .select("username")
    .eq("profile_id", user.id)
    .single();
  const { error } = await admin
    .from("public_profiles")
    .update({
      profile_audience: parsed.data.profile,
      message_audience: parsed.data.messaging,
      phone_audience: parsed.data.phone,
      email_audience: parsed.data.email,
      reviews_visible: parsed.data.reviews,
      activity_visible: parsed.data.activity,
      search_indexed: parsed.data.searchIndexed,
    })
    .eq("profile_id", user.id);
  if (error) {
    logger.error("Profile privacy update failed", { userId: user.id, error });
    return actionFailure("Privacy settings could not be saved.");
  }
  await appendActivity(user.id, {
    category: "profile",
    eventKey: "privacy.updated",
    title: "Privacy settings updated",
  });
  revalidateProfileRoutes(current?.username);
  return actionSuccess(undefined);
}

export async function addMarketplacePersonaAction(input: unknown) {
  const parsed = addPersonaSchema.safeParse(input);
  if (!parsed.success)
    return actionFailure("Choose a valid marketplace persona.");
  const { user } = await requireUser({ redirectTo: "/profile/edit" });
  const admin = createUntypedClient();
  const { count } = await admin
    .from("profile_personas")
    .select("persona", { count: "exact", head: true })
    .eq("profile_id", user.id);
  const first = (count ?? 0) === 0;
  const { error } = await admin.from("profile_personas").insert({
    profile_id: user.id,
    persona: parsed.data,
    is_primary: first,
    is_active: first,
  });
  if (error?.code === "23505")
    return actionFailure("That persona is already on your profile.");
  if (error) return actionFailure("The persona could not be added.");
  await admin
    .from(`${parsed.data}_profile_details`)
    .insert({ profile_id: user.id });
  await appendActivity(user.id, {
    category: "profile",
    eventKey: "persona.added",
    title: `${capitalize(parsed.data)} persona added`,
  });
  revalidateProfileRoutes();
  return actionSuccess({ persona: parsed.data });
}

export async function setActivePersonaAction(input: unknown) {
  if (!isMarketplacePersona(input))
    return actionFailure("Choose a valid marketplace persona.");
  const { user } = await requireUser({ redirectTo: "/profile" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_active_profile_persona", {
    target_persona: input,
  });
  if (error)
    return actionFailure("That persona is not available on your profile.");
  await appendActivity(user.id, {
    category: "profile",
    eventKey: "persona.activated",
    title: `Switched to ${input}`,
  });
  revalidatePath("/profile", "layout");
  revalidatePath("/dashboard", "layout");
  return actionSuccess({ persona: input });
}

export async function updatePersonaDetailsAction(input: unknown) {
  const parsed = personaDetailsSchema.safeParse(input);
  if (!parsed.success)
    return fieldErrorFailure(parsed.error.flatten().fieldErrors);
  const { user } = await requireUser({ redirectTo: "/profile/edit" });
  const admin = createUntypedClient();
  const { data: membership } = await admin
    .from("profile_personas")
    .select("persona")
    .eq("profile_id", user.id)
    .eq("persona", parsed.data.persona)
    .maybeSingle();
  if (!membership)
    return actionFailure("Add this persona before saving its details.");

  const d = parsed.data.details as Record<string, unknown>;
  const row = Object.fromEntries(
    Object.entries(d).map(([key, value]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      value,
    ]),
  );
  const { error } = await admin
    .from(`${parsed.data.persona}_profile_details`)
    .upsert({ profile_id: user.id, ...row }, { onConflict: "profile_id" });
  if (error) {
    logger.error("Persona details update failed", {
      userId: user.id,
      persona: parsed.data.persona,
      error,
    });
    return actionFailure("Persona details could not be saved.");
  }
  await appendActivity(user.id, {
    category: "profile",
    eventKey: "persona.updated",
    title: `${capitalize(parsed.data.persona)} details updated`,
  });
  revalidateProfileRoutes();
  return actionSuccess(undefined);
}

export async function setProfileRelationshipAction(input: {
  profileId: string;
  relationship: "block" | "mute";
  enabled: boolean;
}) {
  const parsed = z
    .object({
      profileId: z.string().uuid(),
      relationship: z.enum(["block", "mute"]),
      enabled: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return actionFailure("Invalid profile relationship.");
  const { user } = await requireUser({ redirectTo: "/profile" });
  if (parsed.data.profileId === user.id)
    return actionFailure("You cannot apply this to your own profile.");
  const admin = createUntypedClient();
  const table =
    parsed.data.relationship === "block" ? "profile_blocks" : "profile_mutes";
  const actorKey =
    parsed.data.relationship === "block" ? "blocker_id" : "muter_id";
  const subjectKey =
    parsed.data.relationship === "block" ? "blocked_id" : "muted_id";
  const mutation = parsed.data.enabled
    ? admin
        .from(table)
        .upsert({ [actorKey]: user.id, [subjectKey]: parsed.data.profileId })
    : admin
        .from(table)
        .delete()
        .eq(actorKey, user.id)
        .eq(subjectKey, parsed.data.profileId);
  const { error } = await mutation;
  if (error)
    return actionFailure(
      `The profile could not be ${parsed.data.relationship}d.`,
    );
  revalidateTag("public-profiles", "max");
  return actionSuccess(undefined);
}

export async function contactProfileAction(input: unknown) {
  const parsed = contactProfileSchema.safeParse(input);
  if (!parsed.success)
    return fieldErrorFailure(parsed.error.flatten().fieldErrors);
  const { user } = await requireUser({ redirectTo: "/profile" });
  const limit = await consumeRateLimit({
    key: `profile-contact:${user.id}:${parsed.data.recipientId}`,
    requests: 5,
    window: "24 h",
  });
  if (!limit.success)
    return actionFailure(
      "You have reached the contact limit for this profile today.",
    );
  const admin = createUntypedClient();
  const [{ data: block }, { data: recipientProfile }] = await Promise.all([
    admin
      .from("profile_blocks")
      .select("blocker_id")
      .or(
        `and(blocker_id.eq.${user.id},blocked_id.eq.${parsed.data.recipientId}),and(blocker_id.eq.${parsed.data.recipientId},blocked_id.eq.${user.id})`,
      )
      .limit(1)
      .maybeSingle(),
    admin
      .from("public_profiles")
      .select("message_audience,profile_audience")
      .eq("profile_id", parsed.data.recipientId)
      .maybeSingle(),
  ]);
  if (block) return actionFailure("Contact is unavailable for this profile.");
  if (!recipientProfile || recipientProfile.profile_audience === "no_one") {
    return actionFailure("This profile is not accepting contact.");
  }
  if (recipientProfile.message_audience === "no_one") {
    return actionFailure("This member has disabled new messages.");
  }
  if (recipientProfile.message_audience === "interactions") {
    const { count: interactionCount } = await admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .or(
        `and(renter_id.eq.${user.id},landlord_id.eq.${parsed.data.recipientId}),and(renter_id.eq.${parsed.data.recipientId},landlord_id.eq.${user.id})`,
      );
    if (!interactionCount) {
      return actionFailure(
        "This member accepts messages only from existing interaction participants.",
      );
    }
  }

  let selectedListing: {
    id: string;
    landlord_id: string;
    listing_type: "rent" | "sale";
  } | null = null;
  if (parsed.data.listingId) {
    const { data: listing } = await admin
      .from("listings")
      .select("id,landlord_id,listing_type")
      .eq("id", parsed.data.listingId)
      .eq("landlord_id", parsed.data.recipientId)
      .eq("status", "published")
      .maybeSingle();
    if (!listing)
      return actionFailure("That public listing is no longer available.");
    const requiredPersona =
      listing.listing_type === "sale" ? "buyer" : "renter";
    const { data: persona } = await admin
      .from("profile_personas")
      .select("persona")
      .eq("profile_id", user.id)
      .eq("persona", requiredPersona)
      .maybeSingle();
    if (!persona) {
      return actionFailure(
        `Add your ${requiredPersona} persona before contacting this listing.`,
      );
    }
    selectedListing = listing;
  }

  const { error } = await admin.from("profile_contact_requests").insert({
    requester_id: user.id,
    recipient_id: parsed.data.recipientId,
    intent: parsed.data.intent,
    listing_id: parsed.data.listingId,
    message: parsed.data.message,
  });
  if (error) return actionFailure("Your contact request could not be sent.");

  let conversationId: string | null = null;
  if (selectedListing) {
    const { data: conversation } = await admin
      .from("conversations")
      .upsert(
        {
          listing_id: selectedListing.id,
          renter_id: user.id,
          landlord_id: parsed.data.recipientId,
          type: "inquiry",
        },
        { onConflict: "listing_id,renter_id" },
      )
      .select("id")
      .single();
    conversationId = conversation?.id ?? null;
    if (conversationId) {
      await admin.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        listing_id: selectedListing.id,
        content: parsed.data.message,
      });
    }
  }
  await appendActivity(user.id, {
    category: "message",
    eventKey: "profile.contact_sent",
    title: "Contact request sent",
  });
  return actionSuccess({ conversationId });
}

export async function saveProfileReviewAction(input: unknown) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success)
    return fieldErrorFailure(parsed.error.flatten().fieldErrors);
  const { user } = await requireUser({ redirectTo: "/profile/reviews" });
  const admin = createUntypedClient();
  const { data: entitlement } = await admin
    .from("profile_review_entitlements")
    .select("id,subject_id,closes_at")
    .eq("id", parsed.data.entitlementId)
    .eq("reviewer_id", user.id)
    .gt("closes_at", new Date().toISOString())
    .maybeSingle();
  if (!entitlement)
    return actionFailure("This verified interaction is no longer reviewable.");
  const { data: existing } = await admin
    .from("profile_reviews")
    .select("id,status")
    .eq("entitlement_id", entitlement.id)
    .maybeSingle();
  if (existing && existing.status !== "draft") {
    return actionFailure("Submitted reviews cannot be edited.");
  }
  const now = new Date();
  const publishAfter = new Date(
    now.getTime() + 14 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await admin.from("profile_reviews").upsert(
    {
      entitlement_id: entitlement.id,
      reviewer_id: user.id,
      subject_id: entitlement.subject_id,
      overall: parsed.data.overall,
      communication: parsed.data.communication,
      honesty: parsed.data.honesty,
      professionalism: parsed.data.professionalism,
      property_accuracy: parsed.data.propertyAccuracy,
      viewing_experience: parsed.data.viewingExperience,
      responsiveness: parsed.data.responsiveness,
      body: parsed.data.body,
      status: parsed.data.submit ? "submitted" : "draft",
      submitted_at: parsed.data.submit ? now.toISOString() : null,
      publish_after: parsed.data.submit ? publishAfter : null,
    },
    { onConflict: "entitlement_id" },
  );
  if (error) return actionFailure("The review could not be saved.");
  revalidatePath("/profile/reviews");
  revalidateTag("public-profiles", "max");
  return actionSuccess(undefined);
}

export async function updateNormalizedNotificationPreferenceAction(
  input: unknown,
) {
  const parsed = notificationPreferenceSchema.safeParse(input);
  if (!parsed.success)
    return actionFailure("Choose a valid notification preference.");
  const { user } = await requireUser({ redirectTo: "/settings/notifications" });
  const mandatory =
    parsed.data.channel === "in_app" &&
    (parsed.data.category === "security" ||
      parsed.data.category === "account_updates");
  const enabled = mandatory ? true : parsed.data.enabled;
  const frequency =
    mandatory && parsed.data.frequency === "never"
      ? "instant"
      : parsed.data.frequency;
  const admin = createUntypedClient();
  const { error } = await admin.from("notification_subscriptions").upsert(
    {
      user_id: user.id,
      category: parsed.data.category,
      channel: parsed.data.channel,
      enabled,
      frequency,
    },
    { onConflict: "user_id,category,channel" },
  );
  if (error)
    return actionFailure("Notification preference could not be saved.");
  revalidatePath("/settings/notifications");
  return actionSuccess({ enabled, frequency });
}

const documentMetadataSchema = z.object({
  documentType: z.enum([
    "id",
    "passport",
    "drivers_license",
    "payslip",
    "employment_letter",
    "bank_statement",
    "lease_agreement",
    "proof_of_residence",
    "student_proof",
    "business_registration",
    "tax_document",
    "other",
  ]),
  displayName: z.string().trim().min(1).max(180),
  expiresAt: z.string().date().nullable(),
});

export async function uploadProfileDocumentAction(formData: FormData) {
  const parsed = documentMetadataSchema.safeParse({
    documentType: formData.get("documentType"),
    displayName: formData.get("displayName"),
    expiresAt: formData.get("expiresAt") || null,
  });
  if (!parsed.success)
    return fieldErrorFailure(parsed.error.flatten().fieldErrors);
  const file = formData.get("file");
  if (!(file instanceof File))
    return fieldErrorFailure({ file: ["Choose a document."] });
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  if (!allowedTypes.includes(file.type))
    return fieldErrorFailure({
      file: ["Upload a PDF, JPEG, PNG, or WebP file."],
    });
  if (file.size < 1 || file.size > 20 * 1024 * 1024) {
    return fieldErrorFailure({
      file: ["Documents must be smaller than 20 MB."],
    });
  }
  const { user } = await requireUser({ redirectTo: "/profile/documents" });
  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const documentId = randomUUID();
  const versionId = randomUUID();
  const extension =
    file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const path = `${user.id}/${documentId}/${versionId}.${extension}`;
  const admin = createUntypedClient();
  const { error: uploadError } = await admin.storage
    .from("profile-documents")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    logger.error("Profile document upload failed", {
      userId: user.id,
      error: uploadError,
    });
    return actionFailure("The document could not be uploaded.");
  }
  const { error: documentError } = await admin
    .from("profile_documents")
    .insert({
      id: documentId,
      owner_id: user.id,
      document_type: parsed.data.documentType,
      display_name: parsed.data.displayName,
      expires_at: parsed.data.expiresAt,
    });
  const { error: versionError } = documentError
    ? { error: documentError }
    : await admin.from("profile_document_versions").insert({
        id: versionId,
        document_id: documentId,
        owner_id: user.id,
        version: 1,
        bucket: "profile-documents",
        path,
        mime_type: file.type,
        size_bytes: file.size,
        checksum_sha256: checksum,
      });
  if (documentError || versionError) {
    await admin.storage.from("profile-documents").remove([path]);
    if (!documentError)
      await admin.from("profile_documents").delete().eq("id", documentId);
    return actionFailure("The document metadata could not be saved.");
  }
  await admin
    .from("profile_documents")
    .update({ current_version_id: versionId })
    .eq("id", documentId);
  await appendActivity(user.id, {
    category: "document",
    eventKey: "document.uploaded",
    title: "Document added",
    summary: parsed.data.displayName,
  });
  revalidatePath("/profile/documents");
  return actionSuccess({ documentId });
}

export async function deleteProfileDocumentAction(documentId: string) {
  const parsed = z.string().uuid().safeParse(documentId);
  if (!parsed.success) return actionFailure("Invalid document.");
  const { user } = await requireUser({ redirectTo: "/profile/documents" });
  const admin = createUntypedClient();
  const { data: activeShare } = await admin
    .from("profile_document_shares")
    .select("id,application:applications(status)")
    .eq("document_id", parsed.data)
    .eq("owner_id", user.id)
    .is("revoked_at", null);
  if (
    (activeShare ?? []).some((share) =>
      share.application.some(
        (application) =>
          !["rejected", "withdrawn"].includes(application.status),
      ),
    )
  ) {
    return actionFailure(
      "This document is attached to an active application and cannot be deleted.",
    );
  }
  const { error } = await admin
    .from("profile_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("owner_id", user.id);
  if (error) return actionFailure("The document could not be deleted.");
  revalidatePath("/profile/documents");
  return actionSuccess(undefined);
}

export async function updateAccountIdentityAction(input: unknown) {
  const parsed = z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("email"), value: z.string().trim().email() }),
      z.object({
        kind: z.literal("phone"),
        value: z.string().trim().min(8).max(50),
      }),
      z.object({
        kind: z.literal("password"),
        value: z.string().min(12).max(200),
      }),
    ])
    .safeParse(input);
  if (!parsed.success)
    return fieldErrorFailure(parsed.error.flatten().fieldErrors);
  const { user } = await requireUser({ redirectTo: "/settings/security" });
  if (!(await sensitiveSessionIsFresh())) {
    return actionFailure(
      "Confirm your sign-in again before changing account identity or password.",
    );
  }
  const supabase = await createClient();
  const update =
    parsed.data.kind === "email"
      ? { email: parsed.data.value }
      : parsed.data.kind === "phone"
        ? { phone: parsed.data.value }
        : { password: parsed.data.value };
  const { error } = await supabase.auth.updateUser(update);
  if (error) return actionFailure(error.message);
  const admin = createUntypedClient();
  await admin.from("account_security_events").insert({
    user_id: user.id,
    event_key: `${parsed.data.kind}.change_requested`,
    metadata: {},
  });
  revalidatePath("/settings/security");
  return actionSuccess(undefined);
}

export async function labelRecognizedDeviceAction(input: unknown) {
  const parsed = z
    .object({
      deviceId: z.string().uuid(),
      label: z.string().trim().min(1).max(80),
    })
    .safeParse(input);
  if (!parsed.success)
    return fieldErrorFailure(parsed.error.flatten().fieldErrors);
  const { user } = await requireUser({ redirectTo: "/settings/security" });
  const admin = createUntypedClient();
  const { error } = await admin
    .from("recognized_devices")
    .update({ label: parsed.data.label })
    .eq("id", parsed.data.deviceId)
    .eq("user_id", user.id);
  if (error) return actionFailure("The device label could not be saved.");
  revalidatePath("/settings/security");
  return actionSuccess(undefined);
}
