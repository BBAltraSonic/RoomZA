import { z } from "zod";
import type { Database } from "@/lib/supabase/types";

export const notificationInboxQuerySchema = z.object({
  before: z.string().datetime({ offset: true }).optional(),
  beforeId: z.string().uuid().optional(),
}).strict().refine((value) => Boolean(value.before) === Boolean(value.beforeId), "Invalid notification page");

export type NotificationInboxRow = Pick<Database["public"]["Tables"]["notification_events"]["Row"], "id" | "type" | "payload" | "read_at" | "created_at">;

const titles: Partial<Record<NotificationInboxRow["type"], string>> = {
  incoming_call: "Call update",
  showing_request: "Showing requested",
  showing_accepted: "Showing accepted",
  showing_declined: "Showing declined",
  admin_alert: "Operations alert",
};

export function notificationForDisplay(row: NotificationInboxRow) {
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
  let href: string | null = null;
  if (row.type === "incoming_call" && z.string().uuid().safeParse(payload.conversationId).success) href = `/messages/${payload.conversationId}`;
  if (["showing_request", "showing_accepted", "showing_declined"].includes(row.type) && z.string().uuid().safeParse(payload.listingId).success) href = `/listing/${payload.listingId}`;
  if (row.type === "admin_alert" && z.string().uuid().safeParse(payload.caseId).success) href = `/admin/reports/${payload.caseId}`;
  return {
    id: row.id,
    title: titles[row.type] ?? "Account update",
    message: typeof payload.message === "string" && payload.message.trim() ? payload.message : "You have a new account update.",
    createdAt: row.created_at,
    unread: row.read_at === null,
    href,
  };
}
