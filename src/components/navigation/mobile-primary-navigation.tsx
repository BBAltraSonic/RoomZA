"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Building2, Heart, Home, Map, MessageCircle, Plus, ShieldCheck, Store, Wrench, type LucideIcon } from "lucide-react";
import { useUnreadMessageCount } from "@/features/chat/unread-messages";
import { useNotifications } from "@/features/notifications/notification-provider";
import { authPathForRedirect } from "@/lib/redirects";
import { cn } from "@/lib/utils";
import { isNavigationItemActive, memberNavigation } from "./navigation-config";

type Destination = { label: string; href: string; icon: LucideIcon; isActive: (pathname: string) => boolean };

const startsWithSegment = (pathname: string, path: string) => pathname === path || pathname.startsWith(path + "/");
const isMyListingsRoute = (pathname: string) => isNavigationItemActive(memberNavigation.find(item => item.id === "my-listings")!, pathname);

const NOTIFICATIONS_HREF = "/profile/notifications";
const MESSAGES_HREF = "/messages";

const createDestination: Destination = { label: "Create", href: "/post", icon: Plus, isActive: pathname => pathname === "/post" };

const memberDestinations: Destination[] = [
  { label: "Explore", href: "/", icon: Map, isActive: pathname => ["/", "/services", "/offers"].includes(pathname) },
  { label: "Saved", href: "/saved", icon: Heart, isActive: pathname => startsWithSegment(pathname, "/saved") },
  { label: "My listings", href: "/post/listings", icon: Building2, isActive: isMyListingsRoute },
  { label: "Messages", href: MESSAGES_HREF, icon: MessageCircle, isActive: pathname => startsWithSegment(pathname, MESSAGES_HREF) },
  { label: "Notifications", href: NOTIFICATIONS_HREF, icon: Bell, isActive: pathname => startsWithSegment(pathname, NOTIFICATIONS_HREF) },
];

/** Signed-out visitors only get destinations they can open without an account. */
const guestDestinations: Destination[] = [
  { label: "Explore", href: "/", icon: Map, isActive: pathname => pathname === "/" },
  { label: "Specials", href: "/offers", icon: Store, isActive: pathname => pathname === "/offers" },
  { label: "Services", href: "/services", icon: Wrench, isActive: pathname => pathname === "/services" },
  { label: "Listings", href: "/listings", icon: Home, isActive: pathname => startsWithSegment(pathname, "/listings") },
  { label: "Trust", href: "/trust", icon: ShieldCheck, isActive: pathname => startsWithSegment(pathname, "/trust") },
];

/** Routes owned by the account menu circle (profile, settings and the remaining workspace pages). */
function isAccountRoute(pathname: string) {
  if (memberDestinations.some(destination => destination.isActive(pathname))) return false;
  return ["/profile", "/settings", "/purchases", "/viewings"].some(path => startsWithSegment(pathname, path));
}

const floatingSurface = "pointer-events-auto border border-border/60 bg-panel text-ink shadow-[0_8px_24px_oklch(0.2_0.02_265/12%),0_1px_3px_oklch(0.2_0.02_265/8%)]";
/** The Create and account circles give up some width on phones narrower than 360px. */
const circleSize = "size-12 shrink-0 min-[360px]:size-14";
const iconButton ="relative flex items-center justify-center rounded-full outline-none transition-[background-color,color,transform] duration-150 touch-manipulation focus-visible:ring-2 focus-visible:ring-ring active:scale-95 motion-reduce:transform-none";

function DockLink({ destination, pathname, isAuthenticated, className, badge }: {
  destination: Destination; pathname: string; isAuthenticated: boolean; className: string; badge?: ReactNode;
}) {
  const active = destination.isActive(pathname);
  const Icon = destination.icon;
  // Guests only see public pill destinations, so Create is the one link that needs a sign-in detour.
  const href = destination === createDestination && !isAuthenticated ? authPathForRedirect(destination.href) : destination.href;
  return <Link prefetch={false} href={href}
    aria-current={active ? "page" : undefined}
    className={cn(iconButton, className, active ? "bg-muted text-ink" : "text-muted-foreground hover:text-ink")}>
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
 * Floating mobile dock: Create circle, a five-icon pill, and the account circle
 * that opens the profile menu. Members get their workspace destinations in the pill;
 * guests get public destinations they can open without signing in.
 */
export function MobilePrimaryNavigation({ pathname, isAuthenticated, accountMenu }: {
  pathname: string; isAuthenticated: boolean; accountMenu: ReactNode;
}) {
  const live = useNotifications();
  const unreadNotifications = isAuthenticated && live?.enabled ? live.unreadCount : 0;
  // New message notifications change the notification count, so it doubles as a refresh signal.
  const unreadMessages = useUnreadMessageCount(isAuthenticated, `${pathname}|${live?.unreadCount ?? 0}`);
  const destinations = isAuthenticated ? memberDestinations : guestDestinations;
  const badges: Record<string, number> = { [NOTIFICATIONS_HREF]: unreadNotifications, [MESSAGES_HREF]: unreadMessages };
  const accountActive = isAuthenticated && isAccountRoute(pathname);

  return <nav aria-label="Primary mobile navigation" data-mobile-navigation
    className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-nav-menu)] px-3 transition-[transform,opacity] duration-200 motion-reduce:transition-none min-[360px]:px-4 lg:hidden"
    style={{ paddingBottom: "calc(var(--mobile-safe-bottom) + 0.75rem)" }}>
    <div className="mx-auto flex w-full max-w-md items-center justify-between gap-1.5 min-[360px]:gap-2">
      <DockLink destination={createDestination} pathname={pathname} isAuthenticated={isAuthenticated}
        className={cn(floatingSurface, circleSize)} />

      {/* Five icons share the space between the circles; each caps at 44px and shrinks on narrow phones. */}
      <div data-mobile-pill className={cn(floatingSurface, "flex h-12 min-w-0 flex-1 items-center justify-between gap-0.5 rounded-full p-1 min-[360px]:h-14 min-[360px]:p-1.5")}>
        {destinations.map(destination => <DockLink key={destination.href} destination={destination} pathname={pathname}
          isAuthenticated={isAuthenticated} className="h-10 min-w-0 max-w-11 flex-1 min-[360px]:h-11"
          badge={<CountBadge count={badges[destination.href] ?? 0} />} />)}
      </div>

      <div data-mobile-account data-active={accountActive ? "true" : undefined}
        className={cn(floatingSurface, circleSize, "relative rounded-full", accountActive && "ring-2 ring-ink")}>
        {accountMenu}
      </div>
    </div>
  </nav>;
}
