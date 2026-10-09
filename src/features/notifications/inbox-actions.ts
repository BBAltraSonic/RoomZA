"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { actionFailure, actionSuccess } from "@/lib/action-result";

export async function markNotificationRead(input: unknown) {
  const id = z.string().uuid().safeParse(input);
  if (!id.success) return actionFailure("Invalid notification.");
  const { user } = await requireUser({ redirectTo: "/profile/notifications" });
  const client = await createClient();
  const owned = await client.from("notification_events").select("id,read_at").eq("id", id.data).eq("recipient_id", user.id).maybeSingle();
  if (owned.error || !owned.data) return actionFailure("That notification could not be updated.");
  if (owned.data.read_at === null) {
    const result = await client.from("notification_events").update({ read_at: new Date().toISOString() }).eq("id", id.data).eq("recipient_id", user.id).is("read_at", null);
    if (result.error) return actionFailure("That notification could not be updated.");
  }
  revalidatePath("/profile/notifications");
  revalidatePath("/profile");
  return actionSuccess(undefined);
}
