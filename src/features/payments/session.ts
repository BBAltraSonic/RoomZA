import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * The caller's Supabase session id, or null when the access token does not
 * belong to `userId`. The deposit database functions check it is still active.
 */
export async function currentSessionId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const sessionId = z.string().uuid().safeParse(claims.data?.claims.session_id);
  if (claims.error || claims.data?.claims.sub !== userId || !sessionId.success) return null;
  return sessionId.data;
}
