import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { getProfileReviewsEventsApi } from "@/features/profile/data";
import { profileReviewsQuerySchema } from "@/features/profile/schema";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiFailure({ code: "unauthorized", message: "Sign in to view reviews." }, 401, { requestId });
  const parsed = profileReviewsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return apiFailure({ code: "validation_failed", message: "Invalid review history query." }, 400, { requestId });
  const { data, error } = await getProfileReviewsEventsApi(user.id, parsed.data.direction, parsed.data.before, parsed.data.limit);
  if (error) return apiFailure({ code: "server_error", message: "Review history could not be loaded." }, 500, { requestId });
  const rows = data ?? [];
  const page = rows.slice(0, parsed.data.limit);
  return apiSuccess({
    items: page,
    nextCursor: rows.length > parsed.data.limit ? page.at(-1)?.created_at ?? null : null,
  }, { requestId });
}
