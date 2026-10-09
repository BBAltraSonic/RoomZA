import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/premium/primitives";
import { getNotificationInbox } from "@/features/notifications/inbox-data";
import { MarkReadButton } from "@/features/notifications/mark-read-button";

export const metadata: Metadata = { title: "Your Notifications", robots: { index: false, follow: false } };
const dateFormat = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" });

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ before?: string; beforeId?: string }> }) {
  const inbox = await getNotificationInbox(await searchParams);
  return <div className="space-y-8">
    <PageHeader eyebrow="Private updates" title="Notifications" description="Updates for your account. Open the related item to see its current status." />
    <Link href="/profile" prefetch={false} className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline">Return to your profile</Link>
    {inbox.status !== "ready" ? <div role="alert" className="space-y-3 rounded-xl border border-border bg-panel p-5">
      <p>{inbox.status === "invalid" ? "This notification page link is invalid." : "Notifications could not be loaded. Try again."}</p>
      <Link href="/profile/notifications" prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-forest underline">Load latest notifications</Link>
    </div> : inbox.items.length ? <ol aria-label="Your notifications" className="border-y border-border">
      {inbox.items.map((item) => <li key={item.id} className="space-y-3 border-b border-border py-5 last:border-b-0">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">{item.title}</h2><StatusBadge tone={item.unread ? "forest" : "neutral"}>{item.unread ? "Unread" : "Read"}</StatusBadge></div>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{item.message}</p>
        <time dateTime={item.createdAt} className="block text-xs text-muted-foreground">{dateFormat.format(new Date(item.createdAt))} SAST</time>
        {item.href ? <Link href={item.href} prefetch={false} className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline">Open related item</Link> : null}
        {item.unread ? <div><MarkReadButton id={item.id} /></div> : null}
      </li>)}
    </ol> : <div className="border-y border-border py-12 text-center"><p className="font-semibold">No notifications yet</p><p className="mt-2 text-sm text-muted-foreground">Updates appear here when there is activity for your account.</p></div>}
    {inbox.next ? <Link href={`/profile/notifications?${new URLSearchParams(inbox.next)}`} prefetch={false} className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline">Load older notifications</Link> : null}
  </div>;
}
