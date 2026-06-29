import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const bboxPartCount = 4;
const maxLatitude = 90;
const maxLongitude = 180;

type ListingRpcRow = {
  id: string;
  title: string;
  address: string;
  price: number;
  latitude: number | string;
  longitude: number | string;
  bedrooms: number | string;
  bathrooms: number | string;
  image_urls?: string[] | null;
  thumbnail_url?: string | null;
  availability_date?: string | null;
  property_type?: string | null;
  created_at?: string | null;
};

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
  const requestId = getRequestId(request);
  const ip = getClientIp(request);
  const limit = await consumeRateLimit({
    key: `listings:${ip}`,
    requests: 120,
    window: "1 m",
  });

  if (!limit.success) {
    return apiFailure(
      { code: "rate_limited", message: "Too many listing requests. Try again later." },
      429,
      {
        requestId,
        headers: {
          "Retry-After": `${Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))}`,
          "X-RateLimit-Limit": `${limit.limit}`,
          "X-RateLimit-Remaining": `${limit.remaining}`,
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseBbox(searchParams.get("bbox"));
  const q = searchParams.get("q") || undefined;

  const minPrice = searchParams.has("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
  const maxPrice = searchParams.has("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
  const beds = searchParams.has("beds") ? Number(searchParams.get("beds")) : undefined;
  const baths = searchParams.has("baths") ? Number(searchParams.get("baths")) : undefined;
  const type = searchParams.get("type") || undefined;

  if ("error" in parsed) {
    return apiFailure({ code: "validation_failed", message: parsed.error ?? "Invalid bbox." }, 400, { requestId });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_published_listings_in_bbox_with_query", {
    ...parsed.bbox,
    search_query: q,
    min_price: minPrice && !isNaN(minPrice) ? minPrice : undefined,
    max_price: maxPrice && !isNaN(maxPrice) ? maxPrice : undefined,
    min_beds: beds && !isNaN(beds) ? beds : undefined,
    min_baths: baths && !isNaN(baths) ? baths : undefined,
    property_type_filter: type,
  });

  if (error) {
    logger.error("Listing viewport query failed", { requestId, error });
    return apiFailure({ code: "server_error", message: "Unable to load listings." }, 500, { requestId });
  }

  const listings = (data as ListingRpcRow[]).map((listing) => ({
      id: listing.id,
      title: listing.title,
      area: listing.address,
      price: listing.price,
      latitude: Number(listing.latitude),
      longitude: Number(listing.longitude),
      bedrooms: Number(listing.bedrooms),
      bathrooms: Number(listing.bathrooms),
      imageUrls: listing.image_urls || (listing.thumbnail_url ? [listing.thumbnail_url] : []),
      availabilityDate: listing.availability_date,
      propertyType: listing.property_type,
      created_at: listing.created_at,
    }));

  return apiSuccess({ listings }, { requestId });
}
