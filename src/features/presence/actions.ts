"use server";

import { z } from "zod";

import { actionSuccess, actionFailure, type ActionResult } from "@/lib/action-result";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

import type { AvailabilityMode, PresenceBadge } from "./presence-status";

const availabilityModeSchema = z.enum(["auto", "available", "busy", "invisible"]);
const desiredStatusSchema = z.enum(["available", "busy"]).optional();

/**
 * Records a presence heartbeat for the signed-in user via the throttled
 * `touch_presence` RPC (design §3.1). The RPC itself is write-throttled (only
 * persists when the row is stale) so this is safe to call on a cadence.
 *
 * Returns the resolved `presence_status` so the client can reconcile the badge
 * for its own avatar without a second read.
 */
export async function touchPresence(
  desired?: "available" | "busy",
): Promise<ActionResult<{ status: PresenceBadge | null }>> {
  const parsed = desiredStatusSchema.safeParse(desired);
  if (!parsed.success) {
    return actionFailure("Invalid presence status.");
  }

  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    // Presence is ambient and must never block; an unauthenticated heartbeat is
    // a benign no-op, not an error worth surfacing.
    return actionSuccess({ status: null });
  }

  const { data, error } = await supabase.rpc("touch_presence", {
    desired: parsed.data ?? "available",
  });

  if (error) {
    logger.error("touch_presence failed", { error: error.message });
    return actionFailure("Failed to update presence.");
  }

  const status = (data?.[0]?.presence_status ?? null) as PresenceBadge | null;
  return actionSuccess({ status });
}

/**
 * Sets the landlord's explicit availability control (design §3.1). Persisted on
 * `profiles.availability_mode` via the self-row update RLS; the next heartbeat
 * or sweep reconciles `presence_status`.
 */
export async function setAvailabilityMode(
  mode: AvailabilityMode,
): Promise<ActionResult<{ mode: AvailabilityMode }>> {
  const parsed = availabilityModeSchema.safeParse(mode);
  if (!parsed.success) {
    return actionFailure("Invalid availability mode.");
  }

  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return actionFailure("You must be signed in to change availability.");
  }

  const { error } = await supabase.rpc("set_availability_mode", {
    target_mode: parsed.data,
  });

  if (error) {
    logger.error("setAvailabilityMode failed", { error: error.message });
    return actionFailure("Failed to update availability.");
  }

  return actionSuccess({ mode: parsed.data });
}
