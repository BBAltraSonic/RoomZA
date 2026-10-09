import "server-only";

import { requireUser } from "@/lib/auth";
import { getProfileNotificationsEventsApi } from "@/features/profile/data";
import { notificationForDisplay, notificationInboxQuerySchema, type NotificationInboxRow } from "./inbox-contract";

export async function getNotificationInbox(query: unknown) {
  const { user } = await requireUser({ redirectTo: "/profile/notifications" });
  const parsed = notificationInboxQuerySchema.safeParse(query);
  if (!parsed.success) return { status: "invalid" as const, items: [], next: null };
  const { data, error } = await getProfileNotificationsEventsApi(user.id, parsed.data.before, 30, parsed.data.beforeId);
  if (error) return { status: "unavailable" as const, items: [], next: null };
  const rows = (data ?? []) as NotificationInboxRow[];
  const page = rows.slice(0, 30);
  const last = page.at(-1);
  return {
    status: "ready" as const,
    items: page.map(notificationForDisplay),
    next: rows.length > 30 && last ? { before: last.created_at, beforeId: last.id } : null,
  };
}
