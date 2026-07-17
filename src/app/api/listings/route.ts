import { z } from "zod";

import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { getListingsInViewport, parseBbox } from "@/features/listings/api";
import { normalizeListingSearchQuery } from "@/features/listings/search-query";
import { logger } from "@/lib/logger";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";

const listingsQuerySchema = z.object({
  bbox: z.string().min(1, "Invalid bbox."),
  q: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      return normalizeListingSearchQuery(value) || undefined;
    },
    z.string().max(120).optional(),
  ),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  beds: z.coerce.number().int().min(0).optional(),
  baths: z.coerce.number().min(0).optional(),
  type: z.string().trim().min(1).max(50).optional(),
  mode: z.enum(["rent", "buy"]).default("rent"),
});

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
  const parsedQuery = listingsQuerySchema.safeParse({
    bbox: searchParams.get("bbox"),
    q: searchParams.get("q") || undefined,
    minPrice: searchParams.get("minPrice") || undefined,
    maxPrice: searchParams.get("maxPrice") || undefined,
    beds: searchParams.get("beds") || undefined,
    baths: searchParams.get("baths") || undefined,
    type: searchParams.get("type") || undefined,
    mode: searchParams.get("mode") || undefined,
  });

  if (!parsedQuery.success) {
    return apiFailure(
      { code: "validation_failed", message: "Invalid listing query.", details: parsedQuery.error.flatten() },
      400,
      { requestId },
    );
  }

  const { bbox, q, minPrice, maxPrice, beds, baths, type, mode } = parsedQuery.data;
  const parsed = parseBbox(bbox);

  if ("error" in parsed) {
    return apiFailure({ code: "validation_failed", message: parsed.error ?? "Invalid bbox." }, 400, { requestId });
  }

  const result = await getListingsInViewport(parsed.bbox, { q, minPrice, maxPrice, beds, baths, type, mode });

  if ("error" in result) {
    logger.error("Listing viewport query failed", { requestId, error: result.error });
    return apiFailure({ code: "server_error", message: "Unable to load listings." }, 500, { requestId });
  }

  if ("missingSpatialIndex" in result && result.missingSpatialIndex) {
    logger.warn("Listing viewport query used missing spatial index fallback", {
      requestId,
      missingIndex: "listings_location_gix",
    });
  }

  return apiSuccess(
    { listings: result.listings },
    {
      requestId,
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
