"use server";

import { createClient } from "@/lib/supabase/server";
import { applicationSchema } from "./schema";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { Database, Json } from "@/lib/supabase/types";
import { enqueueNotificationEvent } from "@/features/notifications/outbox";
import { groupApplicantsByStatus } from "./applicant-grouping";
import { isPermittedTransition } from "./transitions";
import { logger } from "@/lib/logger";
import { actionSuccess, actionFailure, fieldErrorFailure, type ActionResult } from "@/lib/action-result";
import type { ApplicantApplication } from "./applicant-card";
import type { RenterApplicationListItem } from "./application-types";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];
type DocumentType = Database["public"]["Enums"]["document_type"];

type DocumentUploadMetadata = {
    type: DocumentType;
    bucket: "application-documents";
    path: string;
    mimeType: string;
    byteSize: number;
};

export async function checkApplicationEligibility(listingId: string) {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData?.user) {
        return { eligible: false, reason: "unauthenticated" };
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
    if (profile?.role !== "renter") {
        return { eligible: false, reason: "not_renter" };
    }

    const activeStatuses = ["submitted", "under_review", "shortlisted", "approved"] as const;
    const { count } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("renter_id", userData.user.id)
        .in("status", [...activeStatuses]);

    if ((count || 0) >= 5) {
        return { eligible: false, reason: "cap_reached" };
    }

    const { data: existingApp } = await supabase
        .from("applications")
        .select("id")
        .eq("renter_id", userData.user.id)
        .eq("listing_id", listingId)
        .in("status", [...activeStatuses])
        .maybeSingle();

    if (existingApp) {
        return { eligible: false, reason: "already_applied" };
    }

    return { eligible: true, reason: null };
}

export async function submitApplication(formData: FormData) {
    const { user } = await requireRole("renter");
    const supabase = await createClient();

    // Validate the input using zod
    const raw = Object.fromEntries(formData.entries());
    const result = applicationSchema.safeParse(raw);

    if (!result.success) {
        return fieldErrorFailure(result.error.flatten().fieldErrors, "Invalid application data");
    }

    const { listingId, fullName, income, employmentStatus, moveInDate, householdSize } = result.data;

    // 1. Get files
    const idFile = formData.get("idDocument") as File | null;
    const payslipFile = formData.get("payslipDocument") as File | null;

    if (!idFile || idFile.size === 0 || !payslipFile || payslipFile.size === 0) {
        return actionFailure("Both ID and Payslip documents are required.");
    }

    // 2. Count active applications
    const activeStatuses = ["submitted", "under_review", "shortlisted", "approved"] as const;
    const { count, error: countError } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("renter_id", user.id)
        .in("status", [...activeStatuses]);

    if (countError) {
        logger.error("Failed to check active application count", { userId: user.id, error: countError });
        return actionFailure("Failed to check active application count");
    }

    if ((count || 0) >= 5) {
        return actionFailure("You cannot have more than 5 active applications. Please withdraw one first.");
    }

    // 3. Prevent duplicate active application for the same listing
    const { data: existingApp } = await supabase
        .from("applications")
        .select("id")
        .eq("renter_id", user.id)
        .eq("listing_id", listingId)
        .in("status", [...activeStatuses])
        .maybeSingle();

    if (existingApp) {
        return actionFailure("You already have an active application for this listing.");
    }

    // 4. Upload files to deterministic paths before the atomic metadata insert.
    const applicationId = crypto.randomUUID();
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    const uploadedPaths: string[] = [];
    const documentMetadata: DocumentUploadMetadata[] = [];

    for (const document of [{ type: 'id' as const, file: idFile }, { type: 'payslip' as const, file: payslipFile }]) {
        const file = document.file;
        if (!allowedTypes.includes(file.type)) {
            return actionFailure("Documents must be PDF, JPEG, or PNG files.");
        }

        const ext = file.name.split(".").pop() ?? "pdf";
        const storagePath = `${user.id}/${applicationId}/${document.type}-${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from("application-documents")
            .upload(storagePath, file, { contentType: file.type });

        if (uploadError) {
            if (uploadedPaths.length > 0) {
                await supabase.storage.from("application-documents").remove(uploadedPaths);
            }
            logger.error("Failed to upload application documents", { userId: user.id, error: uploadError });
            return actionFailure("Failed to upload application documents.");
        }

        uploadedPaths.push(storagePath);
        documentMetadata.push({
            type: document.type satisfies DocumentType,
            bucket: "application-documents",
            path: storagePath,
            mimeType: file.type,
            byteSize: file.size,
        });
    }

    // 5. Atomically create the application and document metadata under RLS.
    const { data: rpcRows, error: rpcError } = await supabase.rpc("submit_application_atomic", {
        target_application_id: applicationId,
        target_listing_id: listingId,
        full_name: fullName,
        income,
        employment_status: employmentStatus,
        move_in_date: moveInDate,
        household_size: householdSize,
        document_metadata: documentMetadata as unknown as Json,
    });

    const rpcResult = rpcRows?.[0]?.result;
    if (rpcError || rpcResult !== "created") {
        await supabase.storage.from("application-documents").remove(uploadedPaths);

        const message =
            rpcResult === "cap_reached"
                ? "You cannot have more than 5 active applications. Please withdraw one first."
                : rpcResult === "duplicate_active"
                    ? "You already have an active application for this listing."
                    : rpcResult === "missing_documents"
                        ? "Both ID and Payslip documents are required."
                        : "Failed to submit application.";

        logger.error("Failed to submit application RPC", { userId: user.id, error: rpcError, rpcResult });
        return actionFailure(message);
    }

    // 6. Create Notification Event for Landlord
    const { data: listingData } = await supabase
        .from("listings")
        .select("landlord_id")
        .eq("id", listingId)
        .single();

    if (listingData?.landlord_id) {
        const { data: notification } = await supabase.from("notification_events").insert({
            recipient_id: listingData.landlord_id,
            type: "new_application",
            idempotency_key: `new_application:${applicationId}`,
            payload: {
                applicationId,
                actorId: user.id,
                message: "A new rental application has been submitted.",
            },
        }).select("id").single();

        if (notification?.id) {
            await enqueueNotificationEvent(notification.id);
        }
    }

    revalidatePath("/applications");
    revalidatePath(`/listing/${listingId}`);

    return actionSuccess({ applicationId });
}

export async function withdrawApplication(applicationId: string): Promise<ActionResult> {
    const { user } = await requireRole("renter");
    const supabase = await createClient();

    const { error: updateError } = await supabase
        .from("applications")
        .update({ status: "withdrawn" as const, updated_at: new Date().toISOString() })
        .eq("id", applicationId)
        .eq("renter_id", user.id);

    if (updateError) {
        logger.error("Failed to withdraw application", { userId: user.id, applicationId, error: updateError });
        return actionFailure("Failed to withdraw application");
    }

    revalidatePath("/applications");
    return actionSuccess(undefined);
}

export async function getMyApplications(): Promise<ActionResult<RenterApplicationListItem[]>> {
    const { user } = await requireRole("renter");
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("applications")
        .select(`
        id, status, created_at, listing_id,
        listing:listings(title, address, price),
        conversations(id),
        viewings(id, status, meeting_join_url, meeting_room_id, meeting_starts_at, meeting_ends_at, slot:viewing_slots(id, start_time, end_time, mode)),
        viewing_slot_offers(id, slot:viewing_slots(id, start_time, end_time, is_booked, mode))
    `)
        .eq("renter_id", user.id)
        .order("created_at", { ascending: false });

    if (error) {
        logger.error("Failed to load renter applications", { userId: user.id, error });
        return actionFailure("Unable to load applications.");
    }

    return actionSuccess((data ?? []) as unknown as RenterApplicationListItem[]);
}

export async function getListingApplicants(listingId: string): Promise<ActionResult<ApplicantApplication[]>> {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    // Verify ownership
    const { data: listing } = await supabase
        .from("listings")
        .select("id")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (!listing) return actionFailure("Listing not found or access denied.");

    const { data, error } = await supabase
        .from("applications")
        .select(`
            *,
            renter:profiles!renter_id(*),
            documents(id, type, file_url),
            viewings(id, status, meeting_join_url, meeting_room_id, slot:viewing_slots(id, start_time, end_time, mode)),
            application_status_events(id, from_status, to_status, created_at, actor_id)
        `)
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false });

    if (error) {
        logger.error("Failed to load listing applicants", { userId: user.id, listingId, error });
        return actionFailure("Unable to load applicants.");
    }
    return actionSuccess((data ?? []) as unknown as ApplicantApplication[]);
}

export async function getAllApplicants(): Promise<ActionResult<Record<ApplicationStatus, ApplicantApplication[]>>> {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("applications")
        .select(`
            *,
            listing:listings!inner(id, title, address, price, landlord_id),
            renter:profiles!renter_id(id, email, phone),
            documents(id, type, file_url),
            viewings(id, status, meeting_join_url, meeting_room_id, slot:viewing_slots(id, start_time, end_time, mode)),
            application_status_events(id, from_status, to_status, created_at, actor_id)
        `)
        .eq("listing.landlord_id", user.id)
        .order("created_at", { ascending: false });

    if (error) {
        logger.error("Failed to load all applicants", { userId: user.id, error });
        return actionFailure("Unable to load applicants.");
    }
    return actionSuccess(groupApplicantsByStatus((data ?? []) as unknown as ApplicantApplication[]));
}

export async function getApplicantDetail(applicationId: string): Promise<ActionResult<ApplicantApplication>> {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("applications")
        .select(`
            *,
            listing:listings!inner(id, title, address, price, landlord_id),
            renter:profiles!renter_id(id, email, phone),
            documents(id, type, file_url, mime_type, byte_size, created_at),
            viewings(id, status, meeting_join_url, meeting_room_id, slot:viewing_slots(id, start_time, end_time, mode)),
            application_status_events(id, from_status, to_status, created_at, actor_id)
        `)
        .eq("id", applicationId)
        .eq("listing.landlord_id", user.id)
        .single();

    if (error || !data) {
        logger.error("Failed to load applicant detail", { userId: user.id, applicationId, error });
        return actionFailure("Applicant not found or access denied.");
    }
    return actionSuccess(data as unknown as ApplicantApplication);
}

export async function updateApplicationStatus(applicationId: string, newStatus: ApplicationStatus): Promise<ActionResult> {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    // We do an ownership check manually
    const { data: application } = await supabase
        .from("applications")
        .select("id, listing_id, status, renter_id, listing:listings!inner(landlord_id)")
        .eq("id", applicationId)
        .single();

    const listingData = application?.listing as unknown as { landlord_id: string } | null;
    if (!application || listingData?.landlord_id !== user.id) {
        await supabase.from("analytics_events").insert({
            user_id: user.id,
            event_name: "unauthorized_application_status_update",
            properties: { applicationId },
        });
        return actionFailure("Access denied");
    }

    if (!isPermittedTransition(application.status, newStatus)) {
        return actionFailure("That status transition is not allowed.");
    }

    const { data: updateRows, error } = await supabase.rpc("update_application_status_checked", {
        target_application_id: applicationId,
        target_status: newStatus,
    });

    const result = updateRows?.[0]?.result;
    if (error || result !== "updated") {
        const errorMsg = result === "terminal_status"
            ? "This application is already in a terminal status."
            : result === "invalid_transition"
                ? "That status transition is not allowed."
                : error?.message ?? "Failed to update application status.";
        logger.error("Application status update failed", { userId: user.id, applicationId, errorMsg, error });
        return actionFailure(errorMsg);
    }

    const { data: notification } = await supabase.from("notification_events").insert({
        recipient_id: application.renter_id,
        type: "application_status_changed",
        idempotency_key: `application_status_changed:${applicationId}:${newStatus}`,
        payload: {
            applicationId,
            status: newStatus,
            actorId: user.id,
            message: "Your rental application status changed.",
        },
    }).select("id").single();

    if (notification?.id) {
        await enqueueNotificationEvent(notification.id);
    }

    revalidatePath(`/dashboard/listings/${application.listing_id}/applicants`);
    revalidatePath("/dashboard/applicants");
    return actionSuccess(undefined);
}
