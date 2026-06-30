import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { alertSchema, createSearchAlert } from "@/features/alerts/api";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const ip = getClientIp(request);

  try {
    const limit = await consumeRateLimit({
      key: `alerts:${ip}`,
      requests: 5,
      window: "10 m",
    });

    if (!limit.success) {
      return apiFailure(
        { code: "rate_limited", message: "Too many alert requests. Try again later." },
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

    const body = alertSchema.safeParse(await request.json());
    if (!body.success) {
      return apiFailure(
        { code: "validation_failed", message: "Invalid alert request.", details: body.error.flatten() },
        400,
        { requestId },
      );
    }

    const result = await createSearchAlert(body.data, { requestId, ip });

    if ("error" in result) {
      return apiFailure(
        { code: result.error.code, message: result.error.message },
        result.error.status,
        { requestId },
      );
    }

    return apiSuccess({ success: true }, { requestId });
  } catch (error) {
    logger.warn("Invalid alert request", { requestId, error });
    return apiFailure({ code: "bad_request", message: "Invalid request." }, 400, { requestId });
  }
}
