"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, fieldErrorFailure, type ActionResult, type FieldErrorDetails } from "@/lib/action-result";
import { requireRole } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

import { computeInsights } from "./insights";
import { evaluatePublishReadiness, outstandingConditions } from "./publish-validation";
import { listingSchema, amenitiesSchema, emptyAmenities } from "./schema";
import { validateImageUpload } from "./types";

type ListingWriteResult = ActionResult<{ listingId: string }, FieldErrorDetails>;

export async function createListing(formData: FormData): Promise<ListingWriteResult> {
    const { user } = await requireRole("landlord");

    const raw = Object.fromEntries(formData.entries());
    const parsed = listingSchema.safeParse(raw);

    if (!parsed.success) {
        return fieldErrorFailure(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    // Parse amenities metadata
    let metadata: Record<string, unknown> = {};
    const rawMetadata = formData.get("metadata");
    if (typeof rawMetadata === "string" && rawMetadata.trim().length > 0) {
        try {
            const parsed_meta = JSON.parse(rawMetadata);
            const amenitiesResult = amenitiesSchema.safeParse(parsed_meta.amenities);
            metadata = { amenities: amenitiesResult.success ? amenitiesResult.data : emptyAmenities };
        } catch {
            metadata = { amenities: emptyAmenities };
        }
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("listings")
        .insert({
            landlord_id: user.id,
            ...parsed.data,
            metadata: metadata as never,
        })
        .select("id")
        .single();

    if (error) {
        logger.error("Listing create failed", { userId: user.id, error });
        return fieldErrorFailure({ _form: ["Unable to create listing. Try again."] }, "Unable to create listing.");
    }

    revalidatePath("/dashboard");
    return actionSuccess({ listingId: data.id });
}

export async function updateListing(listingId: string, formData: FormData): Promise<ListingWriteResult> {
    const { user } = await requireRole("landlord");

    const raw = Object.fromEntries(formData.entries());
    const parsed = listingSchema.safeParse(raw);

    if (!parsed.success) {
        return fieldErrorFailure(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    // Parse amenities metadata
    let metadata: Record<string, unknown> = {};
    const rawMetadata = formData.get("metadata");
    if (typeof rawMetadata === "string" && rawMetadata.trim().length > 0) {
        try {
            const parsed_meta = JSON.parse(rawMetadata);
            const amenitiesResult = amenitiesSchema.safeParse(parsed_meta.amenities);
            metadata = { amenities: amenitiesResult.success ? amenitiesResult.data : emptyAmenities };
        } catch {
            metadata = { amenities: emptyAmenities };
        }
    }

    const supabase = await createClient();

    // Verify ownership
    const { data: existing } = await supabase
        .from("listings")
        .select("id, landlord_id")
        .eq("id", listingId)
        .single();

    if (!existing || existing.landlord_id !== user.id) {
        logger.warn("Unauthorized listing update attempt", { userId: user.id, listingId });
        return fieldErrorFailure({ _form: ["Listing not found or access denied."] }, "Listing not found or access denied.");
    }

    const { error } = await supabase
        .from("listings")
        .update({
            ...parsed.data,
            metadata: metadata as never,
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
        return actionFailure("Listing not found or access denied.");
    }

    return actionSuccess(data ?? null);
}

export async function getListingImages(listingId: string) {
    await requireRole("landlord");
    const supabase = await createClient();

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

    // Verify listing ownership
    const { data: listing } = await supabase
        .from("listings")
        .select("id, landlord_id")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (!listing) {
        logger.warn("Unauthorized listing image upload attempt", { userId: user.id, listingId });
        return actionFailure("Listing not found or access denied.");
    }

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
        return actionFailure("No file provided.");
    }

    const imageValidation = validateImageUpload(file.type, file.size);
    if (!imageValidation.valid) {
        return actionFailure(imageValidation.error);
    }

    // Determine next sort order
    const { count } = await supabase
        .from("listing_images")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId);

    const sortOrder = count ?? 0;

    // Upload to storage: {userId}/{listingId}/{uuid}.{ext}
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
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    // Get the image record with listing ownership check
    const { data: image } = await supabase
        .from("listing_images")
        .select("id, path, listing_id, listing:listings!inner(landlord_id)")
        .eq("id", imageId)
        .single();

    if (!image) {
        return actionFailure("Image not found.");
    }

    const landlordId = (image.listing as unknown as { landlord_id: string })?.landlord_id;
    if (landlordId !== user.id) {
        logger.warn("Unauthorized listing image delete attempt", { userId: user.id, imageId });
        return actionFailure("Access denied.");
    }

    // Delete from storage
    await supabase.storage.from("listing-images").remove([image.path]);

    // Delete DB record
    await supabase.from("listing_images").delete().eq("id", imageId);

    revalidatePath(`/dashboard/listings/${image.listing_id}/edit`);
    return actionSuccess(undefined);
}

export async function publishListing(listingId: string): Promise<ActionResult<undefined, { errors: string[] }>> {
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
        return actionFailure("Listing not found or access denied.", { errors: ["Listing not found or access denied."] });
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
    return actionSuccess(undefined);
}

export async function getPublishReadiness(listingId: string) {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data: listing } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (!listing) return actionFailure("Listing not found or access denied.");

    const { count } = await supabase
        .from("listing_images")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId);

    return actionSuccess(evaluatePublishReadiness(listing, count ?? 0));
}

export async function archiveListing(listingId: string): Promise<ActionResult> {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data: listing } = await supabase
        .from("listings")
        .select("id, status")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (!listing) return actionFailure("Listing not found or access denied.");
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
    return actionSuccess(undefined);
}

export async function restoreListing(listingId: string): Promise<ActionResult> {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data: listing } = await supabase
        .from("listings")
        .select("id, status")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (!listing) return actionFailure("Listing not found or access denied.");
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
        return actionFailure("Listing not found or access denied.");
    }

    const { data: rows, error } = await supabase.rpc("delete_listing_checked", { target_listing_id: listingId });
    const result = rows?.[0]?.result;
    if (error || result !== "deleted") {
        logger.warn("Listing delete failed", { userId: user.id, listingId, result, error });
        return actionFailure(
            result === "active_applications"
                ? "Listings with active applications cannot be deleted. Archive it instead."
                : "Listing not found or access denied.",
        );
    }

    const paths = imageRows.map((image) => image.path).filter(Boolean);
    if (paths.length > 0) {
        await supabase.storage.from("listing-images").remove(paths);
    }

    revalidatePath("/dashboard");
    revalidatePath("/");
    return actionSuccess(undefined);
}

export async function duplicateListing(listingId: string): Promise<ActionResult<{ listingId: string }>> {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data: rows, error } = await supabase.rpc("duplicate_listing", { target_listing_id: listingId });
    const row = rows?.[0];
    if (error || row?.result !== "duplicated" || !row.listing_id) {
        logger.warn("Listing duplicate failed", { userId: user.id, listingId, result: row?.result, error });
        return actionFailure("Listing not found or access denied.");
    }

    revalidatePath("/dashboard");
    return actionSuccess({ listingId: row.listing_id });
}

export async function getListingInsights(listingId: string) {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { data: listing } = await supabase
        .from("listings")
        .select("id")
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .single();

    if (!listing) return actionFailure("Listing not found or access denied.");

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
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

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
    return actionSuccess(undefined);
}

// ── Public listing fetch for deep links (CHE-21) ──

export async function getPublishedListing(listingId: string) {
    const supabase = await createClient();

    const { data: listing } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .eq("status", "published")
        .single();

    if (!listing) {
        return null;
    }

    const { data: images } = await supabase
        .from("listing_images")
        .select("id, public_url, sort_order")
        .eq("listing_id", listingId)
        .order("sort_order", { ascending: true });

    return { ...listing, images: images ?? [] };
}
