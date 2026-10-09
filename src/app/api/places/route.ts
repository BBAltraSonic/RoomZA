import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { getDiscoveryPlaceByProviderId, searchDiscoveryPlaces } from "@/features/places/server";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const providerId = params.get("providerId")?.trim() ?? "";
  if ((query && (query.length < 2 || query.length > 100)) ||
      (providerId && providerId.length > 200) || (!query && !providerId)) {
    return apiFailure({ code: "validation_failed", message: "Enter a valid place search." }, 400, { requestId });
  }
  const limit = await consumeRateLimit({ key: `places:${getClientIp(request)}`, requests: 30, window: "1 m" });
  if (!limit.success) return apiFailure({ code: "rate_limited", message: "Try place search again shortly." }, 429, { requestId });
  try {
    if (providerId) {
      const stored = await getDiscoveryPlaceByProviderId(providerId);
      if (stored) return apiSuccess({ places: [stored] }, { requestId, headers: { "Cache-Control": "no-store" } });
    }
    const places = query ? await searchDiscoveryPlaces(query) : [];
    return apiSuccess({ places: providerId ? places.filter((place) => place.providerId === providerId) : places },
      { requestId, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("Place search failed", { requestId, error });
    return apiFailure({ code: "server_error", message: "Could not search places." }, 500, { requestId });
  }
}
