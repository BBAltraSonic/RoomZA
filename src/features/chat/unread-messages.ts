"use client";

import { useEffect, useState } from "react";

type CountResult = PromiseLike<{ count: number | null; error: unknown }>;

/** The slice of the Supabase browser client this module needs. */
export type UnreadMessageClient = {
  auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
  from: (table: "messages") => {
    select: (columns: "id", options: { count: "exact"; head: true }) => {
      is: (column: "read_at", value: null) => { neq: (column: "sender_id", value: string) => CountResult };
    };
  };
};

/**
 * Counts messages other people sent the viewer that are still unread.
 * Row-level security limits `messages` to the viewer's own conversations.
 * Returns null when the count could not be read, so callers can keep the last value.
 */
export async function fetchUnreadMessageCount(client: UnreadMessageClient): Promise<number | null> {
  const { data: { session } } = await client.auth.getSession();
  const userId = session?.user.id;
  if (!userId) return 0;
  const { count, error } = await client
    .from("messages")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .neq("sender_id", userId);
  if (error) return null;
  return count ?? 0;
}

/**
 * Live unread-message count for the dock badge. Reloads whenever `refreshKey`
 * changes (route changes, new notifications) and when the tab becomes visible.
 */
export function useUnreadMessageCount(enabled: boolean, refreshKey: unknown): number {
  const [count, setCount] = useState(0);
  const [visibleTick, setVisibleTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => { if (document.visibilityState === "visible") setVisibleTick(tick => tick + 1); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void import("@/lib/supabase/browser")
      .then(({ createClient }) => fetchUnreadMessageCount(createClient() as unknown as UnreadMessageClient))
      .then(value => { if (!cancelled && value !== null) setCount(value); })
      .catch(() => { /* A badge is best-effort; keep the last known count. */ });
    return () => { cancelled = true; };
  }, [enabled, refreshKey, visibleTick]);

  return enabled ? count : 0;
}
