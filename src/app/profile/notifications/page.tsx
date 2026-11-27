import type { Metadata } from "next";
import { NotificationInbox } from "@/features/notifications/notification-inbox";
import { requireUser } from "@/lib/auth";
export const metadata:Metadata={title:"Your notifications",robots:{index:false,follow:false}};
export default async function NotificationsPage(){
 await requireUser({redirectTo:"/profile/notifications"});
 return <div className="mx-auto max-w-3xl"><h1 className="sr-only">Notifications</h1><NotificationInbox/></div>;
}
