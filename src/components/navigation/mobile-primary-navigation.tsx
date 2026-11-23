"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Heart, Map, MessageCircle, Plus, type LucideIcon } from "lucide-react";
import { useUnreadMessageCount } from "@/features/chat/unread-messages";
import { useNotifications } from "@/features/notifications/notification-provider";
import { authPathForRedirect } from "@/lib/redirects";
import { cn } from "@/lib/utils";

type Destination = { label: string; href: string; icon: LucideIcon; isActive: (pathname: string) => boolean };

const startsWithSegment = (pathname: string, path: string) => pathname === path || pathname.startsWith(path + "/");

const NOTIFICATIONS_HREF = "/profile/notifications";
const MESSAGES_HREF = "/messages";
const CREATE_HREF = "/post";

const pillDestinations: Destination[] = [
  { label: "Explore", href: "/", icon: Map, isActive: pathname => ["/", "/services", "/offers"].includes(pathname) },
  { label: "Saved", href: "/saved", icon: Heart, isActive: pathname => startsWithSegment(pathname, "/saved") },
  { label: "Notifications", href: NOTIFICATIONS_HREF, icon: Bell, isActive: pathname => startsWithSegment(pathname, NOTIFICATIONS_HREF) },
  { label: "Messages", href: MESSAGES_HREF, icon: MessageCircle, isActive: pathname => startsWithSegment(pathname, MESSAGES_HREF) },
];

/** Routes owned by the profile circle (profile, listings, settings and the other workspace pages). */
function isAccountRoute(pathname: string) {
  if (pillDestinations.some(destination => destination.isActive(pathname))) return false;
  return pathname === "/post/listings"
    || ["/profile", "/settings", "/dashboard", "/purchases", "/viewings"].some(path => startsWithSegment(pathname, path));
}

/** Explore is public; everything else needs an account, so guests go through sign-in and come back. */
const hrefFor = (href: string, isAuthenticated: boolean) => isAuthenticated || href === "/" ? href : authPathForRedirect(href);

const elevation = "shadow-[0_8px_24px_oklch(0.2_0.02_265/12%),0_1px_3px_oklch(0.2_0.02_265/8%)]";
const floatingSurface = cn("pointer-events-auto border border-border/60 bg-panel text-ink", elevation);
/** The Create and profile circles give up some width on phones narrower than 360px. */
const circleSize = "size-12 shrink-0 min-[360px]:size-14";
const iconButton = "relative flex items-center justify-center rounded-full outline-none transition-[background-color,color,transform,filter] duration-150 touch-manipulation focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:transform-none";

function CreateLink({ pathname, isAuthenticated }: { pathname: string; isAuthenticated: boolean }) {
  const active = pathname === CREATE_HREF;
  return <Link prefetch={false} href={hrefFor(CREATE_HREF, isAuthenticated)} data-accent="brand"
    aria-current={active ? "page" : undefined}
    className={cn(iconButton, circleSize, elevation,
      "pointer-events-auto bg-[var(--brand-amber)] text-[var(--brand-charcoal)] hover:brightness-105",
      active && "ring-2 ring-ink ring-offset-2 ring-offset-background")}>
    <Plus aria-hidden="true" className="size-6" strokeWidth={2.6} />
    <span className="sr-only">Create</span>
  </Link>;
}

function PillLink({ destination, pathname, isAuthenticated, badge }: {
  destination: Destination; pathname: string; isAuthenticated: boolean; badge?: ReactNode;
}) {
  const active = destination.isActive(pathname);
  const Icon = destination.icon;
  return <Link prefetch={false} href={hrefFor(destination.href, isAuthenticated)}
    aria-current={active ? "page" : undefined}
    className={cn(iconButton, "size-10 min-[360px]:size-11", active ? "bg-muted text-ink" : "text-muted-foreground hover:text-ink")}>
    <Icon aria-hidden="true" className="size-[22px]" strokeWidth={active ? 2.4 : 1.9} />
    <span className="sr-only">{destination.label}</span>
    {badge}
  </Link>;
}

function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return <>
    <span aria-hidden="true" className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-selection px-1 text-center text-[0.625rem] font-bold leading-4 text-selection-foreground ring-2 ring-panel">
      {count > 99 ? "99+" : count}
    </span>
    <span className="sr-only">, {count} unread</span>
  </>;
}

/**
 * Floating mobile dock: a brand-yellow Create circle, a pill of
 * Explore / Saved / Notifications / Messages, and the profile circle that opens the account menu.
 */
export function MobilePrimaryNavigation({ pathname, isAuthenticated, accountMenu }: {
  pathname: string; isAuthenticated: boolean; accountMenu: ReactNode;
}) {
  const live = useNotifications();
  const unreadNotifications = isAuthenticated && live?.enabled ? live.unreadCount : 0;
  // New message notifications change the notification count, so it doubles as a refresh signal.
  const unreadMessages = useUnreadMessageCount(isAuthenticated, `${pathname}|${live?.unreadCount ?? 0}`);
  const badges: Record<string, number> = { [NOTIFICATIONS_HREF]: unreadNotifications, [MESSAGES_HREF]: unreadMessages };
  const accountActive = isAuthenticated && isAccountRoute(pathname);

  return <nav aria-label="Primary mobile navigation" data-mobile-navigation
    className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-nav-menu)] px-3 transition-[transform,opacity] duration-200 motion-reduce:transition-none min-[360px]:px-4 lg:hidden"
    style={{ paddingBottom: "calc(var(--mobile-safe-bottom) + 0.75rem)" }}>
    <div className="mx-auto flex w-full max-w-md items-center justify-between gap-1.5 min-[360px]:gap-2">
      <CreateLink pathname={pathname} isAuthenticated={isAuthenticated} />

      <div data-mobile-pill className={cn(floatingSurface, "flex h-12 items-center gap-1 rounded-full p-1 min-[360px]:h-14 min-[360px]:p-1.5")}>
        {pillDestinations.map(destination => <PillLink key={destination.href} destination={destination} pathname={pathname}
          isAuthenticated={isAuthenticated} badge={<CountBadge count={badges[destination.href] ?? 0} />} />)}
      </div>

      <div data-mobile-account data-active={accountActive ? "true" : undefined}
        className={cn(floatingSurface, circleSize, "relative rounded-full", accountActive && "ring-2 ring-ink")}>
        {accountMenu}
      </div>
    </div>
  </nav>;
}
