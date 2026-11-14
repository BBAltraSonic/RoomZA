"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Heart, House, Plus, type LucideIcon } from "lucide-react";
import { useNotifications } from "@/features/notifications/notification-provider";
import { authPathForRedirect } from "@/lib/redirects";
import { cn } from "@/lib/utils";

type Destination = { label: string; href: string; icon: LucideIcon; isActive: (pathname: string) => boolean };

const startsWithSegment = (pathname: string, path: string) => pathname === path || pathname.startsWith(path + "/");

const createDestination: Destination = { label: "Create", href: "/post", icon: Plus, isActive: pathname => pathname === "/post" };

const pillDestinations: Destination[] = [
  { label: "Explore", href: "/", icon: House, isActive: pathname => ["/", "/services", "/offers"].includes(pathname) },
  { label: "Saved", href: "/saved", icon: Heart, isActive: pathname => startsWithSegment(pathname, "/saved") },
  { label: "Notifications", href: "/profile/notifications", icon: Bell, isActive: pathname => startsWithSegment(pathname, "/profile/notifications") },
];

/** Routes owned by the account menu circle (Profile, Messages, workspace pages). */
function isAccountRoute(pathname: string) {
  if (startsWithSegment(pathname, "/profile/notifications")) return false;
  return pathname === "/post/listings"
    || ["/profile", "/settings", "/dashboard", "/purchases", "/viewings", "/messages"].some(path => startsWithSegment(pathname, path));
}

const floatingSurface = "pointer-events-auto border border-border/60 bg-panel text-ink shadow-[0_8px_24px_oklch(0.2_0.02_265/12%),0_1px_3px_oklch(0.2_0.02_265/8%)]";
const iconButton = "relative flex items-center justify-center rounded-full outline-none transition-[background-color,color,transform] duration-150 touch-manipulation focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:transform-none";

function DockLink({ destination, pathname, isAuthenticated, className, badge }: {
  destination: Destination; pathname: string; isAuthenticated: boolean; className: string; badge?: ReactNode;
}) {
  const active = destination.isActive(pathname);
  const Icon = destination.icon;
  return <Link prefetch={false}
    href={destination.href === "/" || isAuthenticated ? destination.href : authPathForRedirect(destination.href)}
    aria-current={active ? "page" : undefined}
    className={cn(iconButton, className, active ? "bg-muted text-ink" : "text-muted-foreground hover:text-ink")}>
    <Icon aria-hidden="true" className="size-[22px]" strokeWidth={active ? 2.4 : 1.9} />
    <span className="sr-only">{destination.label}</span>
    {badge}
  </Link>;
}

function UnreadBadge() {
  const live = useNotifications();
  const unread = live?.enabled ? live.unreadCount : 0;
  if (!unread) return null;
  return <>
    <span aria-hidden="true" className="absolute right-1 top-1 min-w-4 rounded-full bg-selection px-1 text-center text-[0.625rem] font-bold leading-4 text-selection-foreground ring-2 ring-panel">
      {unread > 99 ? "99+" : unread}
    </span>
    <span className="sr-only">, {unread} unread</span>
  </>;
}

/**
 * Floating mobile dock: Create circle, a pill of Explore / Saved / Notifications,
 * and the account circle that opens the profile menu (Profile, Messages, settings…).
 */
export function MobilePrimaryNavigation({ pathname, isAuthenticated, accountMenu }: {
  pathname: string; isAuthenticated: boolean; accountMenu: ReactNode;
}) {
  const accountActive = isAccountRoute(pathname);
  return <nav aria-label="Primary mobile navigation" data-mobile-navigation
    className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-nav-menu)] px-4 transition-[transform,opacity] duration-200 motion-reduce:transition-none lg:hidden"
    style={{ paddingBottom: "calc(var(--mobile-safe-bottom) + 0.75rem)" }}>
    <div className="mx-auto flex w-full max-w-md items-center justify-between gap-2">
      <DockLink destination={createDestination} pathname={pathname} isAuthenticated={isAuthenticated}
        className={cn(floatingSurface, "size-14 shrink-0")} />

      <div data-mobile-pill className={cn(floatingSurface, "flex h-14 items-center gap-1 rounded-full p-1.5")}>
        {pillDestinations.map(destination => <DockLink key={destination.href} destination={destination} pathname={pathname}
          isAuthenticated={isAuthenticated} className="size-11"
          badge={destination.href === "/profile/notifications" && isAuthenticated ? <UnreadBadge /> : undefined} />)}
      </div>

      <div data-mobile-account data-active={accountActive ? "true" : undefined}
        className={cn(floatingSurface, "relative size-14 shrink-0 rounded-full", accountActive && "ring-2 ring-ink")}>
        {accountMenu}
      </div>
    </div>
  </nav>;
}
