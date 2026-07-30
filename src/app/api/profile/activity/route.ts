import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { getProfileActivityEventsApi } from "@/features/profile/data";
import { profileActivityQuerySchema } from "@/features/profile/schema";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiFailure({ code: "unauthorized", message: "Sign in to view activity." }, 401, { requestId });
  const url = new URL(request.url);
  const parsed = profileActivityQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return apiFailure({ code: "validation_failed", message: "Invalid activity cursor or filter." }, 400, { requestId });
  }
  const { data, error } = await getProfileActivityEventsApi(user.id, parsed.data.category, parsed.data.before, parsed.data.limit);
  if (error) return apiFailure({ code: "server_error", message: "Activity could not be loaded." }, 500, { requestId });
  const rows = data ?? [];
  const hasMore = rows.length > parsed.data.limit;
  const page = rows.slice(0, parsed.data.limit);
  return apiSuccess({
    items: page,
    nextCursor: hasMore ? page.at(-1)?.occurred_at ?? null : null,
  }, { requestId });
}
