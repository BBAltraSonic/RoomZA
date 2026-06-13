import { z } from "zod";

import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { verifyTurnstileToken } from "@/lib/turnstile";

const bboxSchema = z.object({
  west: z.number().min(-180).max(180),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  north: z.number().min(-90).max(90),
});

const alertSchema = z.object({
  email: z.string().email(),
  bbox: bboxSchema,
  filters: z.record(z.unknown()).nullable().optional(),
  turnstileToken: z.string().optional(),
});

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

    const { email, bbox, filters, turnstileToken } = body.data;
    const verified = await verifyTurnstileToken(turnstileToken, ip);
    if (!verified) {
      return apiFailure({ code: "forbidden", message: "Bot verification failed." }, 403, { requestId });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("search_alerts").insert({
      email,
      bounding_box_west: bbox.west,
      bounding_box_south: bbox.south,
      bounding_box_east: bbox.east,
      bounding_box_north: bbox.north,
      filters: (filters ?? null) as Json | null,
      user_id: user?.id || null,
    });

    if (error) {
      logger.error("Search alert creation failed", { requestId, error });
      return apiFailure({ code: "server_error", message: "Failed to create alert." }, 500, { requestId });
    }

    return apiSuccess({ success: true }, { requestId });
  } catch (error) {
    logger.warn("Invalid alert request", { requestId, error });
    return apiFailure({ code: "bad_request", message: "Invalid request." }, 400, { requestId });
  }
}
