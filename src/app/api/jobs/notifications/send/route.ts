import { Receiver } from "@upstash/qstash";
import { z } from "zod";

import { processNotificationJob } from "@/features/notifications/jobs";
import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";

const jobSchema = z.object({
  eventId: z.string().uuid(),
});

async function verifyQstashSignature(request: Request, body: string) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) {
    return process.env.NODE_ENV !== "production";
  }

  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;

  const receiver = new Receiver({ currentSigningKey, nextSigningKey });
  return receiver.verify({
    signature,
    body,
    url: request.url,
  });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const rawBody = await request.text();
  const verified = await verifyQstashSignature(request, rawBody);

  if (!verified) {
    return apiFailure({ code: "unauthorized", message: "Invalid job signature." }, 401, { requestId });
  }

  const parsed = jobSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return apiFailure({ code: "validation_failed", message: "Invalid notification job.", details: parsed.error.flatten() }, 400, {
      requestId,
    });
  }

  const result = await processNotificationJob(parsed.data.eventId, requestId);
  if (!result.sent) {
    return apiFailure({ code: result.code, message: result.message }, result.httpStatus, { requestId });
  }

  return apiSuccess({ sent: true }, { requestId });
}
