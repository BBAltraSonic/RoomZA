import { z } from "zod";

import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { getPublishedListingApiPayload } from "@/features/listings/api";
import { logger } from "@/lib/logger";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";

const listingDetailParamsSchema = z.object({
    id: z.string().uuid("Invalid listing id."),
});

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

    const parsedParams = listingDetailParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
        return apiFailure({ code: "validation_failed", message: "Invalid listing id." }, 400, { requestId });
    }

    const result = await getPublishedListingApiPayload(parsedParams.data.id);

    if ("error" in result) {
        return apiFailure({ code: "not_found", message: "Listing not found." }, 404, { requestId });
    }

    if (!result.imagesLoaded) {
        logger.warn("Listing images failed to load or were empty", { requestId, listingId: parsedParams.data.id });
    }

    return apiSuccess(result.listing, { requestId });
}
