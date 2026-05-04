import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const bboxPartCount = 4;
const maxLatitude = 90;
const maxLongitude = 180;

function parseBbox(value: string | null) {
  if (!value) {
    return { error: "Missing bbox query parameter." };
  }

  const parts = value.split(",").map((part) => Number(part.trim()));

  if (parts.length !== bboxPartCount || parts.some((part) => !Number.isFinite(part))) {
    return { error: "bbox must be four comma-separated numbers: west,south,east,north." };
  }

  const [west, south, east, north] = parts;

  if (Math.abs(west) > maxLongitude || Math.abs(east) > maxLongitude) {
    return { error: "bbox longitude values must be between -180 and 180." };
  }

  if (Math.abs(south) > maxLatitude || Math.abs(north) > maxLatitude) {
    return { error: "bbox latitude values must be between -90 and 90." };
  }

  return { bbox: { west, south, east, north } };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseBbox(searchParams.get("bbox"));

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_published_listings_in_bbox", parsed.bbox);

  if (error) {
    return NextResponse.json({ error: "Unable to load listings." }, { status: 500 });
  }

  return NextResponse.json({
    listings: data.map((listing) => ({
      id: listing.id,
      title: listing.title,
      area: listing.address,
      price: listing.price,
      latitude: Number(listing.latitude),
      longitude: Number(listing.longitude),
      bedrooms: Number(listing.bedrooms),
      bathrooms: Number(listing.bathrooms),
      thumbnailUrl: listing.thumbnail_url,
    })),
  });
}
