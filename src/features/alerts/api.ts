import { z } from "zod";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { verifyTurnstileToken } from "@/lib/turnstile";
import type { ApiErrorCode } from "@/lib/api";

const bboxSchema = z.object({
  west: z.number().min(-180).max(180),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  north: z.number().min(-90).max(90),
});

export const alertSchema = z.object({
  email: z.string().email(),
  bbox: bboxSchema,
  filters: z.record(z.unknown()).nullable().optional(),
  turnstileToken: z.string().optional(),
});

export type CreateAlertInput = z.infer<typeof alertSchema>;

/**
 * Create a search alert. Returns `{ success: true }` on success, or an error
 * object with code/message on failure.
 *
 * Domain logic extracted from the API route handler (R2.1).
 */
export async function createSearchAlert(
  input: CreateAlertInput,
  options: { requestId: string; ip: string | undefined },
): Promise<{ success: true } | { error: { code: ApiErrorCode; message: string; status: number } }> {
  const { email, bbox, filters, turnstileToken } = input;

  const verified = await verifyTurnstileToken(turnstileToken, options.ip);
  if (!verified) {
    return { error: { code: "forbidden", message: "Bot verification failed.", status: 403 } };
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
    logger.error("Search alert creation failed", { requestId: options.requestId, error });
    return { error: { code: "server_error", message: "Failed to create alert.", status: 500 } };
  }

  return { success: true };
}
