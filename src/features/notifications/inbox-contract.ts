import { z } from "zod";
import type { Database } from "@/lib/supabase/types";
export const notificationInboxQuerySchema = z.object({
 before: z.string().datetime({ offset: true }).optional(), beforeId: z.string().uuid().optional(),
}).strict().refine(v => Boolean(v.before) === Boolean(v.beforeId), "Invalid notification page");
export type NotificationInboxRow = Pick<Database["public"]["Tables"]["notification_events"]["Row"], "id" | "type" | "payload" | "read_at" | "created_at"> & { category?: string };
const titles: Record<string,string> = {
 new_message:"New message", incoming_call:"Call update", new_application:"New application",
 application_status_changed:"Application update", viewing_proposed:"Viewing times proposed", viewing_booked:"Viewing booked",
 showing_request:"Showing requested", showing_accepted:"Showing accepted", showing_declined:"Showing declined",
 live_tour_started:"Live tour started", live_tour_scheduled:"Live tour scheduled", live_tour_reminder:"Live tour reminder",
 profile_document_expiry:"Document expiry", admin_alert:"Operations alert", moderation_update:"Moderation update",
 interaction_update:"Activity update", automatic_reminder:"Reminder", saved_item_update:"Saved item update", search_match:"Saved search match",
};
const uuid = (value: unknown): value is string => z.string().uuid().safeParse(value).success;
export function notificationForDisplay(row: NotificationInboxRow) {
 const p = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
 let href: string|null = null;
 if (uuid(p.conversationId)) href="/messages/"+p.conversationId;
 else if (uuid(p.listingId)) href="/listing/"+p.listingId;
 else if (uuid(p.serviceId)) href="/post/services";
 else if (uuid(p.offerId)) href="/offers?detailId="+p.offerId;
 else if (uuid(p.entryId) && ["tourism","event"].includes(String(p.entryCategory))) href="/offers?category="+p.entryCategory+"&detailId="+p.entryId;
 else if (uuid(p.applicationId)) href="/applications";
 else if (uuid(p.documentId)) href="/profile/documents";
 else if (["offer_posters","entry_posters"].includes(String(p.sourceKind))) href="/post/listings";
 else if (p.sourceKind === "profile_reviews") href="/profile/reviews";
 else if (p.sourceKind === "account_security_events") href="/settings/security";
 else if (p.sourceKind === "verification_checks") href="/profile/verification";
 else if (p.sourceKind === "organization_invitations" || p.sourceKind === "organization_memberships") href="/dashboard/organization";
 else if (p.sourceKind === "moderation_cases") href="/profile/notifications";
 else if (uuid(p.profileId)) href="/profile";
 if (p.title==="Listing update") {
  if (uuid(p.serviceId)) href="/post/services";
  else if (uuid(p.offerId)) href="/post/offers/"+p.offerId;
  else if (uuid(p.entryId) && ["tourism","event"].includes(String(p.entryCategory))) href="/post/entries/"+p.entryCategory+"/"+p.entryId;
 }
 if(p.sourceKind==="profile_contact_requests") href=typeof p.senderUsername==="string" && /^[a-z0-9_]{3,40}$/.test(p.senderUsername)?"/u/"+p.senderUsername:"/profile/notifications";
 if (row.type==="admin_alert" && uuid(p.caseId)) href="/admin/reports/"+p.caseId;
 const namedTitle=typeof p.senderName==="string" && p.senderName.trim() ? (row.type==="new_message"?"Message from "+p.senderName:row.type==="new_application"?"Application from "+p.senderName:row.type==="incoming_call"?"Call with "+p.senderName:null):null;
 return { id:row.id, title:namedTitle?.slice(0,100)?? (typeof p.title==="string" ? p.title.slice(0,100) : titles[row.type]??"Account update"),
 message: typeof p.message==="string" && p.message.trim() ? p.message.slice(0,p.sourceKind==="profile_contact_requests"?1000:600) : "You have a new account update.",
 createdAt:row.created_at, unread:row.read_at===null, href,
 ...(row.category ? { category:row.category } : {}),
 ...(p.sourceKind === "profile_contact_requests" && uuid(p.requestId) ? { contactRequestId:p.requestId } : {}),
 };
}
export type NotificationItem = ReturnType<typeof notificationForDisplay> & {contactHandled?:boolean};
