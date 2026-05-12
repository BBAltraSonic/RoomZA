"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { listingSchema, amenitiesSchema, emptyAmenities, MIN_LISTING_IMAGES } from "./schema";

type ActionResult =
    | { success: true; listingId: string }
    | { success: false; errors: Record<string, string[]> };

export async function createListing(formData: FormData): Promise<ActionResult> {
    const { user } = await requireRole("landlord");

    const raw = Object.fromEntries(formData.entries());
    const parsed = listingSchema.safeParse(raw);

    if (!parsed.success) {
        return { success: false, errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
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
        return { success: false, errors: { _form: [error.message] } };
    }

    revalidatePath("/dashboard");
    return { success: true, listingId: data.id };
}

export async function updateListing(listingId: string, formData: FormData): Promise<ActionResult> {
    const { user } = await requireRole("landlord");

    const raw = Object.fromEntries(formData.entries());
    const parsed = listingSchema.safeParse(raw);

    if (!parsed.success) {
        return { success: false, errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
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
        return { success: false, errors: { _form: ["Listing not found or access denied."] } };
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
        return { success: false, errors: { _form: [error.message] } };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    return { success: true, listingId };
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
        return [];
    }

    return data;
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

    if (error || !data) {
        return null;
    }

    return data;
}

export async function getListingImages(listingId: string) {
    await requireRole("landlord");
    const supabase = await createClient();

    const { data } = await supabase
        .from("listing_images")
        .select("id, public_url, sort_order")
        .eq("listing_id", listingId)
        .order("sort_order", { ascending: true });

    return data ?? [];
}

export type ListingImage = { id: string; public_url: string; sort_order: number };

type ImageActionResult =
    | { success: true; image: ListingImage }
    | { success: false; error: string };

export async function uploadListingImage(listingId: string, formData: FormData): Promise<ImageActionResult> {
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
        return { success: false, error: "Listing not found or access denied." };
    }

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
        return { success: false, error: "No file provided." };
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
        return { success: false, error: "Only JPEG, PNG, and WebP images are allowed." };
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
        return { success: false, error: "Image must be smaller than 10 MB." };
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
        return { success: false, error: `Upload failed: ${uploadError.message}` };
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
        return { success: false, error: `Failed to save image record: ${dbError.message}` };
    }

    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    return { success: true, image: imageRecord };
}

export async function deleteListingImage(imageId: string): Promise<{ success: boolean; error?: string }> {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    // Get the image record with listing ownership check
    const { data: image } = await supabase
        .from("listing_images")
        .select("id, path, listing_id, listing:listings!inner(landlord_id)")
        .eq("id", imageId)
        .single();

    if (!image) {
        return { success: false, error: "Image not found." };
    }

    const landlordId = (image.listing as unknown as { landlord_id: string })?.landlord_id;
    if (landlordId !== user.id) {
        return { success: false, error: "Access denied." };
    }

    // Delete from storage
    await supabase.storage.from("listing-images").remove([image.path]);

    // Delete DB record
    await supabase.from("listing_images").delete().eq("id", imageId);

    revalidatePath(`/dashboard/listings/${image.listing_id}/edit`);
    return { success: true };
}

type PublishResult =
    | { success: true }
    | { success: false; errors: string[] };

export async function publishListing(listingId: string): Promise<PublishResult> {
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
        return { success: false, errors: ["Listing not found or access denied."] };
    }

    if (listing.status === "published") {
        return { success: true };
    }

    // Validate all required fields
    const fieldResult = listingSchema.safeParse(listing);
    const errors: string[] = [];

    if (!fieldResult.success) {
        const fieldErrors = fieldResult.error.flatten().fieldErrors;
        for (const [field, msgs] of Object.entries(fieldErrors)) {
            if (msgs && msgs.length > 0) {
                errors.push(`${field}: ${msgs[0]}`);
            }
        }
    }

    // Check minimum images
    const { count } = await supabase
        .from("listing_images")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId);

    const imageCount = count ?? 0;
    if (imageCount < MIN_LISTING_IMAGES) {
        errors.push(`At least ${MIN_LISTING_IMAGES} images are required (currently ${imageCount}).`);
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    // Publish
    const { error } = await supabase
        .from("listings")
        .update({ status: "published", updated_at: new Date().toISOString() })
        .eq("id", listingId)
        .eq("landlord_id", user.id);

    if (error) {
        return { success: false, errors: [error.message] };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    revalidatePath("/");
    return { success: true };
}

export async function unpublishListing(listingId: string): Promise<{ success: boolean; error?: string }> {
    const { user } = await requireRole("landlord");
    const supabase = await createClient();

    const { error } = await supabase
        .from("listings")
        .update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("id", listingId)
        .eq("landlord_id", user.id)
        .eq("status", "published");

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/listings/${listingId}/edit`);
    revalidatePath("/");
    return { success: true };
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
