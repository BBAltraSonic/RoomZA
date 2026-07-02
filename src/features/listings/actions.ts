"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionFailure, actionSuccess, fieldErrorFailure, type ActionResult, type FieldErrorDetails } from "@/lib/action-result";
import { requireRole } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

import { authorizeOwnedListing, LISTING_OWNERSHIP_DENIED_MESSAGE } from "./authorization";
import { computeInsights } from "./insights";
import { evaluatePublishReadiness, outstandingConditions } from "./publish-validation";
import { listingSchema, amenitiesSchema, emptyAmenities } from "./schema";
import { validateImageUpload, validateListingImageCount } from "./types";

type ListingWriteResult = ActionResult<{ listingId: string }, FieldErrorDetails>;
type Json = Database["public"]["Tables"]["analytics_events"]["Row"]["properties"];
type ListingMetadata = NonNullable<Database["public"]["Tables"]["listings"]["Insert"]["metadata"]>;

const uploadListingImageSchema = z.object({
    listingId: z.string().uuid("Invalid listing id."),
    file: z.custom<File>(
        (value) => typeof File !== "undefined" && value instanceof File && value.size > 0,
        "No file provided.",
    ),
});
const listingIdInputSchema = z.object({
    listingId: z.string().min(1, "Invalid listing id."),
});
const listingIdsInputSchema = z.object({
    listingIds: z.array(z.string().min(1, "Invalid listing id.")).max(100, "Too many listings requested."),
});
const imageIdInputSchema = z.object({
    imageId: z.string().min(1, "Invalid image id."),
});
const publishedListingInputSchema = z.object({
    listingId: z.string().min(1, "Invalid listing id."),
    options: z.object({ trackView: z.boolean().optional() }).default({}),
});

function listingIdFromAnalyticsProperties(properties: Json): string | null {
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
        return null;
    }

    const listingId = (properties as Record<string, unknown>).listingId;
    return typeof listingId === "string" && listingId.length > 0 ? listingId : null;
}

function parseListingMetadata(formData: FormData): ListingMetadata {
    const rawMetadata = formData.get("metadata");
    if (typeof rawMetadata === "string" && rawMetadata.trim().length > 0) {
        try {
            const parsedMetadata = JSON.parse(rawMetadata) as { amenities?: unknown };
            const amenitiesResult = amenitiesSchema.safeParse(parsedMetadata.amenities);
            return { amenities: amenitiesResult.success ? amenitiesResult.data : emptyAmenities };
        } catch {
            return { amenities: emptyAmenities };
        }
    }

    return {};
}

async function recordPublishedListingView(listingId: string): Promise<void> {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return;
    }

    try {
        const supabase = await createClient();
        const { data: userData } = await supabase.auth.getUser();
        const admin = createAdminClient();
        const { error } = await admin.from("analytics_events").insert({
            user_id: userData.user?.id ?? null,
            event_name: "listing_view",
            properties: { listingId },
        });

        if (error) {
            logger.warn("Failed to record listing view", { listingId, error: error.message });
        }
    } catch (error) {
        logger.warn("Failed to record listing view", { listingId, error });
    }
}

export async function createListing(formData: FormData): Promise<ListingWriteResult> {
    const { user } = await requireRole("landlord");

    const raw = Object.fromEntries(formData.entries());
    const parsed = listingSchema.safeParse(raw);

    if (!parsed.success) {
        return fieldErrorFailure(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const metadata = parseListingMetadata(formData);

    const supabase = await createClient();
    const { data: rows, error } = await supabase.rpc("create_listing_checked", {
        ...parsed.data,
        description: parsed.data.description ?? "",
        metadata,
    });
    const row = rows?.[0];

    if (error || row?.result !== "created" || !row.listing_id) {
        logger.error("Listing create failed", { userId: user.id, result: row?.result, error });
        if (row?.result === "access_denied") {
            return fieldErrorFailure({ _form: ["You are not allowed to create listings."] }, "You are not allowed to create listings.");
        }
        if (row?.result === "timeout") {
            return fieldErrorFailure({ _form: ["Listing creation took too long. Try again."] }, "Listing creation took too long.");
        }
        if (row?.result === "invalid_input") {
            return fieldErrorFailure({ _form: ["Fix the highlighted fields before creating the listing."] });
        }
        return fieldErrorFailure({ _form: ["Unable to create listing. Try again."] }, "Unable to create listing.");
    }

    revalidatePath("/dashboard");
    return actionSuccess({ listingId: row.listing_id });
}

export async function updateListing(listingId: string, formData: FormData): Promise<ListingWriteResult> {
    const { user } = await requireRole("landlord");

    const raw = Object.fromEntries(formData.entries());
    const parsed = listingSchema.safeParse(raw);

    if (!parsed.success) {
        return fieldErrorFailure(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const metadata = parseListingMetadata(formData);

    const supabase = await createClient();

    // Verify ownership
    const { data: existing } = await supabase
        .from("listings")
        .select("id, landlord_id")
        .eq("id", listingId)
        .single();

    const ownership = authorizeOwnedListing(existing?.landlord_id, user.id);
    if (!ownership.allowed) {
        logger.warn("Unauthorized listing update attempt", { userId: user.id, listingId });
        return fieldErrorFailure({ _form: [ownership.error] }, ownership.error);
    }

    const { error } = await supabase
        .from("listings")
        .update({
            ...parsed.data,
            metadata,
            updated_at: new Date().toISOString(),
        })
        .eq("id", listingId)
        .eq("landlord_id", user.id);

    if (error) {
        logger.error("Listing update failed", { userId: user.id, listingId, error });
        return fieldErrorFailure({ _form: ["Unable to save listing. Try again."] }, "Unable to save listing.");
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    revalidatePath("/");
    revalidatePath("/listings");
    revalidatePath(`/listing/${listingId}`);
    return actionSuccess({ listingId });
}

export async function getMyListings() {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("listings")
        .select(`
            id, title, price, address, property_type, status, bedrooms, bathrooms, created_at, updated_at,
            listing_images(public_url, sort_order),
            applications(id)
        `)
        .eq("landlord_id", user.id)
        .order("updated_at", { ascending: false });

    if (error) {
        logger.error("Landlord listings query failed", { userId: user.id, error });
        return actionFailure("Unable to load listings.");
    }

    return actionSuccess(data ?? []);
}

export async function getMyListing(listingId: string) {
    const parsedInput = listingIdInputSchema.safeParse({ listingId });
    if (!parsedInput.success) return actionFailure("Invalid listing id.");

    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (error) {
        logger.warn("Landlord listing lookup failed", { userId: user.id, listingId, error });
        return actionFailure(LISTING_OWNERSHIP_DENIED_MESSAGE);
    }

    return actionSuccess(data ?? null);
}

export async function getListingImages(listingId: string) {
    const parsedInput = listingIdInputSchema.safeParse({ listingId });
    if (!parsedInput.success) return actionFailure("Invalid listing id.");

    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data: listing } = await supabase
        .from("listings")
        .select("id, landlord_id")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    const ownership = authorizeOwnedListing(listing?.landlord_id, user.id);
    if (!ownership.allowed) {
        logger.warn("Unauthorized listing image read attempt", { userId: user.id, listingId });
        return actionFailure(ownership.error);
    }

    const { data, error } = await supabase
        .from("listing_images")
        .select("id, public_url, sort_order")
        .eq("listing_id", listingId)
        .order("sort_order", { ascending: true });

    if (error) {
        logger.error("Listing images query failed", { listingId, error });
        return actionFailure("Unable to load listing images.");
    }

    return actionSuccess(data ?? []);
}

export type ListingImage = { id: string; public_url: string; sort_order: number };

export async function uploadListingImage(listingId: string, formData: FormData): Promise<ActionResult<{ image: ListingImage }>> {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const parsedUpload = uploadListingImageSchema.safeParse({
        listingId,
        file: formData.get("file"),
    });

    if (!parsedUpload.success) {
        const message = parsedUpload.error.issues[0]?.message ?? "Invalid image upload.";
        return actionFailure(message);
    }

    const { file } = parsedUpload.data;

    // Verify listing ownership
    const { data: listing } = await supabase
        .from("listings")
        .select("id, landlord_id")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (!listing) {
        logger.warn("Unauthorized listing image upload attempt", { userId: user.id, listingId });
        return actionFailure(LISTING_OWNERSHIP_DENIED_MESSAGE);
    }

    const ownership = authorizeOwnedListing(listing.landlord_id, user.id);
    if (!ownership.allowed) {
        logger.warn("Unauthorized listing image upload attempt", { userId: user.id, listingId });
        return actionFailure(ownership.error);
    }

    const { count } = await supabase
        .from("listing_images")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId);

    const countValidation = validateListingImageCount(count ?? 0, 1);
    if (!countValidation.valid) {
        return actionFailure(countValidation.error);
    }

    const imageValidation = validateImageUpload(file.type, file.size);
    if (!imageValidation.valid) {
        return actionFailure(imageValidation.error);
    }

    const sortOrder = count ?? 0;

    // Storage path keeps uploads under the owner folder required by storage RLS.
    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `${user.id}/${listingId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from("listing-images")
        .upload(storagePath, file, { contentType: file.type });

    if (uploadError) {
        logger.error("Listing image storage upload failed", { userId: user.id, listingId, error: uploadError });
        return actionFailure("Upload failed. Try again.");
    }

    const { data: urlData } = supabase.storage
        .from("listing-images")
        .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Insert DB record
    const { data: imageRecord, error: dbError } = await supabase
        .from("listing_images")
        .insert({
            listing_id: listingId,
            bucket: "listing-images",
            path: storagePath,
            public_url: publicUrl,
            sort_order: sortOrder,
        })
        .select("id, public_url, sort_order")
        .single();

    if (dbError) {
        // Clean up uploaded file on DB failure
        await supabase.storage.from("listing-images").remove([storagePath]);
        logger.error("Listing image record insert failed", { userId: user.id, listingId, error: dbError });
        return actionFailure("Failed to save image record.");
    }

    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    return actionSuccess({ image: imageRecord });
}

export async function deleteListingImage(imageId: string): Promise<ActionResult> {
    const parsedInput = imageIdInputSchema.safeParse({ imageId });
    if (!parsedInput.success) return actionFailure("Invalid image id.");

    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    // Get the image record with listing ownership check
    const { data: image } = await supabase
        .from("listing_images")
        .select("id, path, listing_id, listing:listings!inner(landlord_id)")
        .eq("id", parsedInput.data.imageId)
        .single();

    if (!image) {
        return actionFailure("Image not found.");
    }

    const landlordId = (image.listing as unknown as { landlord_id: string })?.landlord_id;
    const ownership = authorizeOwnedListing(landlordId, user.id);
    if (!ownership.allowed) {
        logger.warn("Unauthorized listing image delete attempt", { userId: user.id, imageId: parsedInput.data.imageId });
        return actionFailure(ownership.error);
    }

    // Delete from storage
    await supabase.storage.from("listing-images").remove([image.path]);

    // Delete DB record
    await supabase.from("listing_images").delete().eq("id", imageId);

    revalidatePath(`/dashboard/listings/${image.listing_id}/edit`);
    return actionSuccess(undefined);
}

export async function publishListing(listingId: string): Promise<ActionResult<undefined, { errors: string[] }>> {
    const parsedInput = listingIdInputSchema.safeParse({ listingId });
    if (!parsedInput.success) {
        return actionFailure("Invalid listing id.", { errors: ["Invalid listing id."] });
    }

    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    // Fetch listing with ownership check
    const { data: listing } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (!listing) {
        logger.warn("Unauthorized listing publish attempt", { userId: user.id, listingId });
        return actionFailure(LISTING_OWNERSHIP_DENIED_MESSAGE, { errors: [LISTING_OWNERSHIP_DENIED_MESSAGE] });
    }

    const ownership = authorizeOwnedListing(listing.landlord_id, user.id);
    if (!ownership.allowed) {
        logger.warn("Unauthorized listing publish attempt", { userId: user.id, listingId });
        return actionFailure(ownership.error, { errors: [ownership.error] });
    }

    if (listing.status === "published") {
        return actionSuccess(undefined);
    }

    const { count } = await supabase
        .from("listing_images")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId);

    const readiness = evaluatePublishReadiness(listing, count ?? 0);
    const errors = outstandingConditions(readiness);

    if (errors.length > 0) {
        return actionFailure("Listing is not ready to publish.", { errors });
    }

    // Publish
    const { error } = await supabase
        .from("listings")
        .update({ status: "published", updated_at: new Date().toISOString() })
        .eq("id", listingId)
        .eq("landlord_id", user.id);

    if (error) {
        logger.error("Listing publish failed", { userId: user.id, listingId, error });
        return actionFailure("Unable to publish listing.", { errors: ["Unable to publish listing. Try again."] });
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    revalidatePath("/");
    revalidatePath("/listings");
    revalidatePath(`/listing/${listingId}`);
    return actionSuccess(undefined);
}

export async function getPublishReadiness(listingId: string) {
    const parsedInput = listingIdInputSchema.safeParse({ listingId });
    if (!parsedInput.success) return actionFailure("Invalid listing id.");

    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data: listing } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (!listing) return actionFailure(LISTING_OWNERSHIP_DENIED_MESSAGE);

    const { count } = await supabase
        .from("listing_images")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId);

    return actionSuccess(evaluatePublishReadiness(listing, count ?? 0));
}

export async function archiveListing(listingId: string): Promise<ActionResult> {
    const parsedInput = listingIdInputSchema.safeParse({ listingId });
    if (!parsedInput.success) return actionFailure("Invalid listing id.");

    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data: listing } = await supabase
        .from("listings")
        .select("id, status")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (!listing) return actionFailure(LISTING_OWNERSHIP_DENIED_MESSAGE);
    if (listing.status === "archived") return actionFailure("Listing is already archived.");

    const { error } = await supabase
        .from("listings")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", listingId)
        .eq("landlord_id", user.id);

    if (error) {
        logger.error("Listing archive failed", { userId: user.id, listingId, error });
        return actionFailure("Unable to archive listing.");
    }
    revalidatePath("/dashboard");
    revalidatePath("/");
    revalidatePath("/listings");
    return actionSuccess(undefined);
}

export async function restoreListing(listingId: string): Promise<ActionResult> {
    const parsedInput = listingIdInputSchema.safeParse({ listingId });
    if (!parsedInput.success) return actionFailure("Invalid listing id.");

    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data: listing } = await supabase
        .from("listings")
        .select("id, status")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (!listing) return actionFailure(LISTING_OWNERSHIP_DENIED_MESSAGE);
    if (listing.status !== "archived") return actionFailure("Only archived listings can be restored.");

    const { error } = await supabase
        .from("listings")
        .update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("id", listingId)
        .eq("landlord_id", user.id);

    if (error) {
        logger.error("Listing restore failed", { userId: user.id, listingId, error });
        return actionFailure("Unable to restore listing.");
    }
    revalidatePath("/dashboard");
    return actionSuccess(undefined);
}

export async function deleteListing(listingId: string): Promise<ActionResult> {
    const parsedInput = listingIdInputSchema.safeParse({ listingId });
    if (!parsedInput.success) return actionFailure("Invalid listing id.");

    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data: images } = await supabase
        .from("listing_images")
        .select("path, listing:listings!inner(landlord_id)")
        .eq("listing_id", listingId);

    const imageRows = images ?? [];
    const ownsListing = imageRows.length === 0 || imageRows.every((image) => {
        const listing = image.listing as unknown as { landlord_id?: string } | null;
        return listing?.landlord_id === user.id;
    });
    if (!ownsListing) {
        logger.warn("Unauthorized listing delete attempt", { userId: user.id, listingId });
        return actionFailure(LISTING_OWNERSHIP_DENIED_MESSAGE);
    }

    const { data: rows, error } = await supabase.rpc("delete_listing_checked", { target_listing_id: listingId });
    const result = rows?.[0]?.result;
    if (error || result !== "deleted") {
        logger.warn("Listing delete failed", { userId: user.id, listingId, result, error });
        return actionFailure(
            result === "active_applications"
                ? "Listings with active applications cannot be deleted. Archive it instead."
                : LISTING_OWNERSHIP_DENIED_MESSAGE,
        );
    }

    logger.info("Audit listing deletion", {
        audit: true,
        actorId: user.id,
        action: "listing_delete",
        listingId,
    });

    const paths = imageRows.map((image) => image.path).filter(Boolean);
    if (paths.length > 0) {
        await supabase.storage.from("listing-images").remove(paths);
    }

    revalidatePath("/dashboard");
    revalidatePath("/");
    revalidatePath("/listings");
    return actionSuccess(undefined);
}

export async function duplicateListing(listingId: string): Promise<ActionResult<{ listingId: string }>> {
    const parsedInput = listingIdInputSchema.safeParse({ listingId });
    if (!parsedInput.success) return actionFailure("Invalid listing id.");

    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data: rows, error } = await supabase.rpc("duplicate_listing", { target_listing_id: listingId });
    const row = rows?.[0];
    if (error || row?.result !== "duplicated" || !row.listing_id) {
        logger.warn("Listing duplicate failed", { userId: user.id, listingId, result: row?.result, error });
        return actionFailure(LISTING_OWNERSHIP_DENIED_MESSAGE);
    }

    revalidatePath("/dashboard");
    return actionSuccess({ listingId: row.listing_id });
}

/**
 * Batched dashboard support: computes publish-readiness + insights for many
 * listings using a constant number of queries (instead of ~4 per listing).
 */
export async function getDashboardListingSupport(listingIds: string[]) {
    const parsedInput = listingIdsInputSchema.safeParse({ listingIds });
    if (!parsedInput.success) {
        return actionFailure("Invalid listing ids.");
    }

    const { user } = await requireRole("landlord");
    if (parsedInput.data.listingIds.length === 0) {
        return actionSuccess({} as Record<string, { readiness: ReturnType<typeof evaluatePublishReadiness>; insights: ReturnType<typeof computeInsights> }>);
    }

    const supabase = await createClient();
    const validatedListingIds = parsedInput.data.listingIds;

    const [
        { data: listingRows, error: listingError },
        { data: imageRows, error: imageError },
        { data: appRows, error: appError },
        { data: slotRows, error: slotError },
        { data: analyticsRows, error: analyticsError },
    ] = await Promise.all([
        supabase.from("listings").select("*").eq("landlord_id", user.id).in("id", validatedListingIds),
        supabase.from("listing_images").select("listing_id").in("listing_id", validatedListingIds),
        supabase.from("applications").select("status, listing_id").in("listing_id", validatedListingIds),
        supabase.from("viewing_slots").select("id, listing_id, start_time").in("listing_id", validatedListingIds),
        supabase.from("analytics_events").select("properties").eq("event_name", "listing_view"),
    ]);

    const supportError = listingError ?? imageError ?? appError ?? slotError ?? analyticsError;
    if (supportError) {
        logger.error("Dashboard listing analytics query failed", { userId: user.id, error: supportError.message });
        return actionFailure("Unable to load dashboard analytics.");
    }

    const slots = slotRows ?? [];
    const slotIds = slots.map((slot) => slot.id);
    const { data: viewingRows, error: viewingError } = slotIds.length
        ? await supabase.from("viewings").select("status, meeting_starts_at, slot_id").in("slot_id", slotIds)
        : { data: [], error: null };

    if (viewingError) {
        logger.error("Dashboard viewing analytics query failed", { userId: user.id, error: viewingError.message });
        return actionFailure("Unable to load dashboard analytics.");
    }

    const imageCounts = new Map<string, number>();
    for (const row of imageRows ?? []) {
        imageCounts.set(row.listing_id, (imageCounts.get(row.listing_id) ?? 0) + 1);
    }

    const appsByListing = new Map<string, { status: Database["public"]["Enums"]["application_status"] }[]>();
    for (const row of appRows ?? []) {
        const list = appsByListing.get(row.listing_id) ?? [];
        list.push({ status: row.status });
        appsByListing.set(row.listing_id, list);
    }

    const targetListingIds = new Set(validatedListingIds);
    const viewsByListing = new Map<string, number>();
    for (const row of analyticsRows ?? []) {
        const listingId = listingIdFromAnalyticsProperties(row.properties);
        if (!listingId || !targetListingIds.has(listingId)) continue;
        viewsByListing.set(listingId, (viewsByListing.get(listingId) ?? 0) + 1);
    }

    const slotById = new Map(slots.map((slot) => [slot.id, slot]));
    const viewingsByListing = new Map<string, { status: Database["public"]["Enums"]["viewing_status"]; meeting_starts_at: string | null; slot: { start_time: string | null } }[]>();
    for (const row of viewingRows ?? []) {
        const slot = slotById.get(row.slot_id);
        if (!slot) continue;
        const list = viewingsByListing.get(slot.listing_id) ?? [];
        list.push({ status: row.status, meeting_starts_at: row.meeting_starts_at, slot: { start_time: slot.start_time } });
        viewingsByListing.set(slot.listing_id, list);
    }

    const now = new Date();
    const support: Record<string, { readiness: ReturnType<typeof evaluatePublishReadiness>; insights: ReturnType<typeof computeInsights> }> = {};
    for (const listing of listingRows ?? []) {
        support[listing.id] = {
            readiness: evaluatePublishReadiness(listing, imageCounts.get(listing.id) ?? 0),
            insights: computeInsights(
                appsByListing.get(listing.id) ?? [],
                viewingsByListing.get(listing.id) ?? [],
                now,
                viewsByListing.get(listing.id) ?? 0,
            ),
        };
    }

    return actionSuccess(support);
}

export async function getListingInsights(listingId: string) {
    const parsedInput = listingIdInputSchema.safeParse({ listingId });
    if (!parsedInput.success) return actionFailure("Invalid listing id.");

    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data: listing } = await supabase
        .from("listings")
        .select("id")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (!listing) return actionFailure(LISTING_OWNERSHIP_DENIED_MESSAGE);

    const [{ data: applications }, { data: viewings }] = await Promise.all([
        supabase.from("applications").select("status").eq("listing_id", listingId),
        supabase
            .from("viewings")
            .select("status, meeting_starts_at, slot:viewing_slots(start_time)")
            .eq("slot.listing_id", listingId),
    ]);

    return actionSuccess(computeInsights(applications ?? [], viewings ?? [], new Date()));
}

export async function unpublishListing(listingId: string): Promise<ActionResult> {
    const parsedInput = listingIdInputSchema.safeParse({ listingId });
    if (!parsedInput.success) return actionFailure("Invalid listing id.");

    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data: listing, error: lookupError } = await supabase
        .from("listings")
        .select("id, status")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (lookupError || !listing) {
        logger.warn("Unauthorized listing unpublish attempt", { userId: user.id, listingId, error: lookupError });
        return actionFailure(LISTING_OWNERSHIP_DENIED_MESSAGE);
    }

    if (listing.status !== "published") {
        return actionFailure("Only published listings can be unpublished.");
    }

    const { error } = await supabase
        .from("listings")
        .update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .eq("status", "published");

    if (error) {
        logger.error("Listing unpublish failed", { userId: user.id, listingId, error });
        return actionFailure("Unable to unpublish listing.");
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    revalidatePath("/");
    revalidatePath("/listings");
    return actionSuccess(undefined);
}

// ── Public listing fetch for deep links (CHE-21) ──

export async function getPublishedListing(listingId: string, options: { trackView?: boolean } = {}) {
    const parsedInput = publishedListingInputSchema.safeParse({ listingId, options });
    if (!parsedInput.success) return null;

    const supabase = await createClient();

    const { data: listing } = await supabase
        .from("listings")
        .select("*")
        .eq("id", parsedInput.data.listingId)
        .eq("status", "published")
        .single();

    if (!listing) {
        return null;
    }

    const { data: images } = await supabase
        .from("listing_images")
        .select("id, public_url, sort_order")
        .eq("listing_id", parsedInput.data.listingId)
        .order("sort_order", { ascending: true });

    if (parsedInput.data.options.trackView) {
        await recordPublishedListingView(parsedInput.data.listingId);
    }

    return { ...listing, images: images ?? [] };
}
