import { z } from "zod";
import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";
import { getDiscoveryPlace } from "@/features/places/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  const id = (await context.params).id;
  if (!z.string().uuid().safeParse(id).success) {
    return apiFailure({ code: "validation_failed", message: "Invalid place ID." }, 400, { requestId });
  }
  try {
    const place = await getDiscoveryPlace(id);
    if (!place) return apiFailure({ code: "not_found", message: "Place not found." }, 404, { requestId });
    return apiSuccess({ place }, { requestId, headers: { "Cache-Control": "public, max-age=0, s-maxage=300" } });
  } catch (error) {
    logger.error("Place lookup failed", { requestId, error });
    return apiFailure({ code: "server_error", message: "Could not load place." }, 500, { requestId });
  }
}
