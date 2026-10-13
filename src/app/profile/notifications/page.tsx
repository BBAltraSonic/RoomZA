import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/premium/primitives";
import { NotificationInbox } from "@/features/notifications/notification-inbox";
import { requireUser } from "@/lib/auth";
export const metadata:Metadata={title:"Your notifications",robots:{index:false,follow:false}};
export default async function NotificationsPage(){
 await requireUser({redirectTo:"/profile/notifications"});
 return <div className="mx-auto max-w-3xl space-y-6"><PageHeader eyebrow="Private updates" title="Notifications" description="Messages, important activity, and reminders for your account."/>
 <Link href="/settings/notifications" prefetch={false} className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline">Notification settings</Link>
 <NotificationInbox/></div>;
}
