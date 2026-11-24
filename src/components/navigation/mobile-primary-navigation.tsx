"use client";

import Link from "next/link";
import { Bell, Heart, Map, MessageCircle, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { useNotifications } from "@/features/notifications/notification-provider";
import { authPathForRedirect } from "@/lib/redirects";
import { cn } from "@/lib/utils";
import { requestAssistantOnArrival, setDockAssistantTrigger, useDockAssistant } from "./dock-assistant";

/** `long` labels need a wider capsule; on phones too narrow for them the capsule shows just its icon. */
type Destination = { label: string; href: string; icon: LucideIcon; isActive: (pathname: string) => boolean; long?: boolean };

const startsWithSegment = (pathname: string, path: string) => pathname === path || pathname.startsWith(path + "/");

const NOTIFICATIONS_HREF = "/profile/notifications";
const MESSAGES_HREF = "/messages";
const CREATE_HREF = "/post";

const pillDestinations: Destination[] = [
  { label: "Explore", href: "/", icon: Map, isActive: pathname => ["/", "/services", "/offers"].includes(pathname) },
  { label: "Saved", href: "/saved", icon: Heart, isActive: pathname => startsWithSegment(pathname, "/saved") },
  { label: "Notifications", href: NOTIFICATIONS_HREF, icon: Bell, isActive: pathname => startsWithSegment(pathname, NOTIFICATIONS_HREF), long: true },
  { label: "Messages", href: MESSAGES_HREF, icon: MessageCircle, isActive: pathname => startsWithSegment(pathname, MESSAGES_HREF) },
];

/** Explore is public; everything else needs an account, so guests go through sign-in and come back. */
const hrefFor = (href: string, isAuthenticated: boolean) => isAuthenticated || href === "/" ? href : authPathForRedirect(href);

const elevation = "shadow-[0_8px_24px_oklch(0.2_0.02_265/12%),0_1px_3px_oklch(0.2_0.02_265/8%)]";
const floatingSurface = cn("pointer-events-auto border border-border/60 bg-panel text-ink", elevation);
/** The Create and assistant circles match the pill's height. */
const circleSize = "size-12 shrink-0";
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

function PillLink({ destination, pathname, isAuthenticated, unread }: {
  destination: Destination; pathname: string; isAuthenticated: boolean; unread: number;
}) {
  const active = destination.isActive(pathname);
  const Icon = destination.icon;
  // The selected item hugs its name; the others share whatever room is left, so
  // the capsule never carries dead space. On phones too narrow for the name (and
  // narrower still for "Notifications") it shows only the highlighted icon.
  const compact = destination.long
    ? { wrap: "max-[389px]:px-2.5", label: "max-[389px]:sr-only" }
    : { wrap: "max-[359px]:px-2.5", label: "max-[359px]:sr-only" };
  return <Link prefetch={false} href={hrefFor(destination.href, isAuthenticated)}
    aria-current={active ? "page" : undefined}
    className={cn(iconButton, "h-10",
      active
        ? cn("shrink-0 gap-1 bg-muted pl-2.5 pr-3 text-ink", compact.wrap)
        : "min-w-8 flex-1 text-muted-foreground hover:text-ink")}>
    <span className="relative flex shrink-0">
      <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.2 : 1.9} />
      {unread ? <span aria-hidden="true" className="absolute -right-2 -top-2 min-w-4 rounded-full bg-selection px-1 text-center text-[0.625rem] font-bold leading-4 text-selection-foreground ring-2 ring-panel">
        {unread > 99 ? "99+" : unread}
      </span> : null}
    </span>
    <span data-pill-label data-visible={active ? "true" : "false"}
      className={active ? cn("whitespace-nowrap text-[0.8125rem] font-semibold leading-none", compact.label) : "sr-only"}>
      {destination.label}
    </span>
    {/* Spoken after the name so screen readers hear "Messages, 3 unread". */}
    {unread ? <span className="sr-only">, {unread} unread</span> : null}
  </Link>;
}

/** Opens the page's assistant; pages without one hand over to Explore, which opens it on arrival. */
function AssistantCircle() {
  const assistant = useDockAssistant();
  const className = cn(iconButton, circleSize, floatingSurface, "hover:text-[var(--brand-amber)]",
    assistant?.open && "ring-2 ring-[var(--brand-amber)] ring-offset-2 ring-offset-background");
  const icon = <Sparkles aria-hidden="true" className="size-5" strokeWidth={2} />;
  if (assistant) {
    return <button ref={setDockAssistantTrigger} type="button" data-mobile-assistant aria-expanded={assistant.open}
      aria-label="Pinpoint Assistant" onClick={assistant.toggle} className={className}>{icon}</button>;
  }
  return <Link prefetch={false} href="/" data-mobile-assistant aria-label="Pinpoint Assistant"
    onClick={requestAssistantOnArrival} className={className}>{icon}</Link>;
}

/**
 * Floating dock: a brand-yellow Create circle, a pill of Explore / Saved / Notifications / Messages
 * (the selected one shows its name), and the Pinpoint Assistant circle. Phones get it on every
 * dock page; desktop gets it floating over the discovery map, beside the results panel.
 */
export function MobilePrimaryNavigation({ pathname, isAuthenticated, unreadMessages = 0, overMap = false }: {
  pathname: string; isAuthenticated: boolean; unreadMessages?: number; overMap?: boolean;
}) {
  const live = useNotifications();
  const unreadNotifications = isAuthenticated && live?.enabled ? live.unreadCount : 0;
  const unreadCounts: Record<string, number> = { [NOTIFICATIONS_HREF]: unreadNotifications, [MESSAGES_HREF]: unreadMessages };

  return <nav aria-label="Primary mobile navigation" data-mobile-navigation data-over-map={overMap ? "true" : undefined}
    className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-nav-menu)] px-3 transition-[transform,opacity] duration-200 motion-reduce:transition-none min-[360px]:px-4",
      overMap ? "lg:left-[var(--discovery-rail-offset)] lg:px-6" : "lg:hidden")}
    style={{ paddingBottom: "calc(var(--mobile-safe-bottom) + 0.75rem)" }}>
    <div className="mx-auto flex w-full max-w-md items-center justify-between gap-1.5 min-[360px]:gap-2">
      <CreateLink pathname={pathname} isAuthenticated={isAuthenticated} />

      <div data-mobile-pill className={cn(floatingSurface, "flex h-12 min-w-0 flex-1 items-center gap-0.5 rounded-full p-1")}>
        {pillDestinations.map(destination => <PillLink key={destination.href} destination={destination} pathname={pathname}
          isAuthenticated={isAuthenticated} unread={unreadCounts[destination.href] ?? 0} />)}
      </div>

      <AssistantCircle />
    </div>
  </nav>;
}
