import { Receiver } from "@upstash/qstash";
import { z } from "zod";

import { processScheduledTourReminder } from "@/features/live-tours/notifications";
import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";

const reminderSchema = z.object({
  tourId: z.string().uuid(),
  scheduledAt: z.string().datetime({ offset: true }),
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
  return receiver.verify({ signature, body, url: request.url });
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const rawBody = await request.text();
  const verified = await verifyQstashSignature(request, rawBody);

  if (!verified) {
    return apiFailure(
      { code: "unauthorized", message: "Invalid job signature." },
      401,
      { requestId },
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return apiFailure(
      { code: "validation_failed", message: "Invalid reminder job." },
      400,
      { requestId },
    );
  }

  const parsed = reminderSchema.safeParse(json);
  if (!parsed.success) {
    return apiFailure(
      {
        code: "validation_failed",
        message: "Invalid reminder job.",
        details: parsed.error.flatten(),
      },
      400,
      { requestId },
    );
  }

  const result = await processScheduledTourReminder(
    parsed.data.tourId,
    parsed.data.scheduledAt,
    requestId,
  );
  if (!result.success) {
    return apiFailure(
      {
        code: result.code,
        message: result.code === "not_found"
          ? "Scheduled tour not found."
          : "Reminder processing failed.",
      },
      result.code === "not_found" ? 404 : 500,
      { requestId },
    );
  }

  return apiSuccess(
    { processed: !result.skipped, skipped: result.skipped },
    { requestId },
  );
}
