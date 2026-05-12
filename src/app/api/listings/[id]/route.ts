import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: listing, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .eq("status", "published")
        .single();

    if (error || !listing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: images } = await supabase
        .from("listing_images")
        .select("id, public_url, sort_order")
        .eq("listing_id", id)
        .order("sort_order", { ascending: true });

    return NextResponse.json({
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
        lease_duration: listing.lease_duration,
        availability_date: listing.availability_date,
        metadata: listing.metadata,
        images: images ?? [],
    });
}
