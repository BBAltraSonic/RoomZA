import { z } from "zod";

import { mergeProgressStage } from "@/features/purchase/progress";
import { apiFailure, apiSuccess, getRequestId } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const favoriteInputSchema = z.object({
  listingId: z.string().uuid(),
  listingType: z.enum(["rent", "sale"]).optional(),
});

export async function getFavorites(request: Request) {
  const requestId = getRequestId(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiSuccess(
      { authenticated: false, favorites: [] as string[] },
      { requestId, headers: { "cache-control": "private, no-store" } },
    );
  }

  const { data, error } = await supabase
    .from("user_favorites")
    .select("listing_id")
    .eq("user_id", user.id);
  if (error) {
    return apiFailure(
      { code: "server_error", message: "Saved homes could not be loaded." },
      500,
      { requestId },
    );
  }

  return apiSuccess(
    {
      authenticated: true,
      favorites: (data ?? []).map((item) => item.listing_id),
    },
    { requestId, headers: { "cache-control": "private, no-store" } },
  );
}

export async function saveFavorite(request: Request) {
  const requestId = getRequestId(request);
  const parsed = favoriteInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return apiFailure(
      { code: "validation_failed", message: "Invalid saved-home request." },
      422,
      { requestId },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiFailure(
      { code: "unauthorized", message: "Sign in to save homes." },
      401,
      { requestId },
    );
  }

  const { error } = await supabase.from("user_favorites").insert({
    listing_id: parsed.data.listingId,
    user_id: user.id,
  });
  if (error && error.code !== "23505") {
    return apiFailure(
      { code: "server_error", message: "The home could not be saved." },
      500,
      { requestId },
    );
  }

  if (parsed.data.listingType === "sale") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role === "renter") {
      const { data: existing } = await supabase
        .from("purchase_progress")
        .select("completed_stages")
        .eq("user_id", user.id)
        .eq("listing_id", parsed.data.listingId)
        .maybeSingle();
      const next = mergeProgressStage(
        existing?.completed_stages ?? [],
        "property_saved",
      );
      await supabase.from("purchase_progress").upsert(
        {
          user_id: user.id,
          listing_id: parsed.data.listingId,
          current_stage: next.currentStage,
          completed_stages: next.completedStages,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,listing_id" },
      );
    }
  }

  return apiSuccess({ saved: true }, { requestId });
}

export async function deleteFavorite(request: Request) {
  const requestId = getRequestId(request);
  const parsed = z
    .string()
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("listingId"));
  if (!parsed.success) {
    return apiFailure(
      { code: "validation_failed", message: "Invalid saved-home request." },
      422,
      { requestId },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiFailure(
      { code: "unauthorized", message: "Sign in to manage saved homes." },
      401,
      { requestId },
    );
  }

  const { error } = await supabase
    .from("user_favorites")
    .delete()
    .eq("listing_id", parsed.data)
    .eq("user_id", user.id);
  if (error) {
    return apiFailure(
      { code: "server_error", message: "The saved home could not be removed." },
      500,
      { requestId },
    );
  }

  return apiSuccess({ saved: false }, { requestId });
}
