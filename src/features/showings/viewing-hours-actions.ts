"use server";

import { z } from "zod";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/action-result";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

import { validateViewingHours, type ViewingHour } from "./viewing-availability";

const hoursSchema = z.array(z.object({
  weekday: z.number().int(),
  startMinute: z.number().int(),
  endMinute: z.number().int(),
})).max(7);

/** The signed-in landlord's weekly viewing hours, Sunday first. */
export async function getMyViewingHours(): Promise<ActionResult<{ hours: ViewingHour[] }>> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return actionFailure("Sign in to manage viewing hours.");
  const { data, error } = await supabase.from("landlord_viewing_hours")
    .select("weekday, start_minute, end_minute").eq("landlord_id", userData.user.id).order("weekday");
  if (error) {
    logger.warn("Failed to load viewing hours", { userId: userData.user.id, error: error.message });
    return actionFailure("Viewing hours could not be loaded. Try again.");
  }
  return actionSuccess({ hours: data.map(row => ({ weekday: row.weekday, startMinute: row.start_minute, endMinute: row.end_minute })) });
}

/** Replaces the whole weekly schedule. An empty list turns the calendar off. */
export async function saveViewingHours(input: ViewingHour[]): Promise<ActionResult<{ hours: ViewingHour[] }>> {
  const parsed = hoursSchema.safeParse(input);
  if (!parsed.success) return actionFailure("Viewing hours are out of range.");
  const valid = validateViewingHours(parsed.data);
  if (!valid.ok) return actionFailure(valid.error);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return actionFailure("Sign in to manage viewing hours.");
  const { error } = await supabase.rpc("set_viewing_hours", { hours: valid.hours });
  if (error) {
    logger.warn("Failed to save viewing hours", { userId: userData.user.id, error: error.message });
    return actionFailure(error.code === "42501" ? "Sign in again before changing viewing hours." : "Viewing hours could not be saved. Try again.");
  }
  return actionSuccess({ hours: valid.hours });
}
