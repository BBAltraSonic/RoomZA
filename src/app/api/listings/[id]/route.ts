import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const requestId = getRequestId(request);
    const ip = getClientIp(request);
    const limit = await consumeRateLimit({
        key: `listing-detail:${ip}`,
        requests: 120,
        window: "1 m",
    });

    if (!limit.success) {
        return apiFailure({ code: "rate_limited", message: "Too many listing requests. Try again later." }, 429, {
            requestId,
            headers: {
                "Retry-After": `${Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))}`,
            },
        });
    }

    const { id } = await params;
    const supabase = await createClient();

    const { data: listing, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .eq("status", "published")
        .single();

    if (error || !listing) {
        return apiFailure({ code: "not_found", message: "Listing not found." }, 404, { requestId });
    }

    const { data: images } = await supabase
        .from("listing_images")
        .select("id, public_url, sort_order")
        .eq("listing_id", id)
        .order("sort_order", { ascending: true });

    const payload = {
        id: listing.id,
        title: listing.title,
        address: listing.address,
        price: listing.price,
        latitude: Number(listing.latitude),
        longitude: Number(listing.longitude),
        bedrooms: Number(listing.bedrooms),
        bathrooms: Number(listing.bathrooms),
        parking_type: listing.parking_type,
        parking_count: listing.parking_count,
        electricity_type: listing.electricity_type,
        water_availability: listing.water_availability,
        property_type: listing.property_type,
        electricity_included: listing.electricity_included,
        electricity_estimate: listing.electricity_estimate,
        water_included: listing.water_included,
        water_estimate: listing.water_estimate,
        wifi_available: listing.wifi_available,
        wifi_included: listing.wifi_included,
        wifi_estimate: listing.wifi_estimate,
        parking_included: listing.parking_included,
        parking_estimate: listing.parking_estimate,
        security_fee_estimate: listing.security_fee_estimate,
        lease_duration: listing.lease_duration,
        availability_date: listing.availability_date,
        created_at: listing.created_at,
        metadata: listing.metadata,
        images: images ?? [],
    };

    if (!images) {
        logger.warn("Listing images failed to load or were empty", { requestId, listingId: id });
    }

    return apiSuccess(payload, { requestId });
}
