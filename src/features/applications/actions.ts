"use server";

import { createClient } from "@/lib/supabase/server";
import { applicationSchema } from "./schema";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { Database } from "@/lib/supabase/types";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];
type DocumentType = Database["public"]["Enums"]["document_type"];

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
        return { success: false, errors: result.error.flatten().fieldErrors, error: "Invalid application data" };
    }

    const { listingId, fullName, income, employmentStatus, moveInDate, householdSize } = result.data;

    // 1. Get files
    const idFile = formData.get("idDocument") as File | null;
    const payslipFile = formData.get("payslipDocument") as File | null;

    if (!idFile || idFile.size === 0 || !payslipFile || payslipFile.size === 0) {
        return { success: false, error: "Both ID and Payslip documents are required." };
    }

    // 2. Count active applications
    const activeStatuses = ["submitted", "under_review", "shortlisted", "approved"] as const;
    const { count, error: countError } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("renter_id", user.id)
        .in("status", [...activeStatuses]);

    if (countError) {
        return { success: false, error: "Failed to check active application count" };
    }

    if ((count || 0) >= 5) {
        return { success: false, error: "You cannot have more than 5 active applications. Please withdraw one first." };
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
        return { success: false, error: "You already have an active application for this listing." };
    }

    // 4. Create the application
    const { data: newApp, error: insertError } = await supabase
        .from("applications")
        .insert({
            listing_id: listingId,
            renter_id: user.id,
            status: "submitted" as const,
            full_name: fullName,
            income: income,
            employment_status: employmentStatus,
            move_in_date: moveInDate,
            household_size: householdSize,
        })
        .select("id")
        .single();

    if (insertError || !newApp) {
        return { success: false, error: "Failed to submit application: " + insertError?.message };
    }

    // 5. Upload files
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    for (const document of [{ type: 'id' as const, file: idFile }, { type: 'payslip' as const, file: payslipFile }]) {
        const file = document.file;
        if (!allowedTypes.includes(file.type)) {
            continue;
        }

        const ext = file.name.split(".").pop() ?? "pdf";
        const storagePath = `${user.id}/${newApp.id}/${document.type}-${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from("application-documents")
            .upload(storagePath, file, { contentType: file.type });

        if (!uploadError) {
            await supabase
                .from("documents")
                .insert({
                    application_id: newApp.id,
                    type: document.type satisfies DocumentType,
                    file_url: storagePath,
                });
        }
    }

    // 6. Create Notification Event for Landlord
    const { data: listingData } = await supabase
        .from("listings")
        .select("landlord_id")
        .eq("id", listingId)
        .single();

    if (listingData?.landlord_id) {
        await supabase.from("notification_events").insert({
            recipient_id: listingData.landlord_id,
            type: "new_application",
            payload: {
                applicationId: newApp.id,
                actorId: user.id,
                message: "A new rental application has been submitted.",
            },
        });
    }

    revalidatePath("/applications");
    revalidatePath(`/listing/${listingId}`);

    return { success: true, applicationId: newApp.id };
}

export async function withdrawApplication(applicationId: string) {
    const { user } = await requireRole("renter");
    const supabase = await createClient();

    const { error: updateError } = await supabase
        .from("applications")
        .update({ status: "withdrawn" as const, updated_at: new Date().toISOString() })
        .eq("id", applicationId)
        .eq("renter_id", user.id);

    if (updateError) {
        return { success: false, error: "Failed to withdraw application" };
    }

    revalidatePath("/applications");
    return { success: true };
}

export async function getMyApplications() {
    const { user } = await requireRole("renter");
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("applications")
        .select(`
        id, status, created_at, listing_id,
        listing:listings(title, address, price),
        conversations(id),
        viewings(id, status, slot:viewing_slots(id, start_time, end_time)),
        viewing_slot_offers(id, slot:viewing_slots(id, start_time, end_time, is_booked))
    `)
        .eq("renter_id", user.id)
        .order("created_at", { ascending: false });

    if (error) {
        return [];
    }

    return data;
}

export async function getListingApplicants(listingId: string) {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    // Verify ownership
    const { data: listing } = await supabase
        .from("listings")
        .select("id")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (!listing) return [];

    const { data, error } = await supabase
        .from("applications")
        .select(`
            *,
            renter:profiles!renter_id(*),
            documents(type, file_url)
        `)
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false });

    if (error) return [];
    return data;
}

export async function updateApplicationStatus(applicationId: string, newStatus: ApplicationStatus) {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    // We do an ownership check manually
    const { data: application } = await supabase
        .from("applications")
        .select("id, listing_id, listing:listings!inner(landlord_id)")
        .eq("id", applicationId)
        .single();

    const listingData = application?.listing as unknown as { landlord_id: string } | null;
    if (!application || listingData?.landlord_id !== user.id) {
        return { success: false, error: "Access denied" };
    }

    const { error } = await supabase
        .from("applications")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", applicationId);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/dashboard/listings/${application.listing_id}/applicants`);
    return { success: true };
}
