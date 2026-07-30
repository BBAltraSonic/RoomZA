import { Receiver } from "@upstash/qstash";

import { processListingImportMessage } from "@/features/listing-imports/processor";
import { importJobMessageSchema } from "@/features/listing-imports/schemas";
import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { logger } from "@/lib/logger";

async function verifyQstashSignature(request: Request, body: string) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return process.env.NODE_ENV !== "production";
  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;
  return new Receiver({ currentSigningKey, nextSigningKey }).verify({ signature, body, url: request.url });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const rawBody = await request.text();
  if (!(await verifyQstashSignature(request, rawBody))) {
    return apiFailure({ code: "unauthorized", message: "Invalid job signature." }, 401, { requestId });
  }

  const parsedJson = (() => {
    try { return JSON.parse(rawBody) as unknown; } catch { return null; }
  })();
  const parsed = importJobMessageSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return apiFailure({ code: "validation_failed", message: "Invalid import job message.", details: parsed.error.flatten() }, 400, { requestId });
  }

  try {
    const retried = Math.max(0, Number(request.headers.get("upstash-retried") ?? parsed.data.attempt) || 0);
    const result = await processListingImportMessage({ ...parsed.data, attempt: Math.min(3, retried) }, requestId);
    return apiSuccess(result, { requestId });
  } catch (error) {
    logger.error("Listing import worker failed", {
      requestId,
      jobId: parsed.data.jobId,
      stage: parsed.data.stage,
      cursor: parsed.data.cursor,
      attempt: parsed.data.attempt,
      error,
    });
    return apiFailure({ code: "server_error", message: "Import processing failed and will be retried." }, 500, { requestId });
  }
}
