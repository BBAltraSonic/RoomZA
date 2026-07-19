"use client";

import { createContext, useContext, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";

import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

import {
  isFocusedNavigationRoute,
  isNavigationItemActive,
  isPublicContentRoute,
  isUserWorkspaceRoute,
  navigationAudience,
  primaryNavigationFor,
  publicNavigation,
  type NavigationAudience,
  type NavigationItem,
} from "./navigation-config";
import { ProfileMenu } from "./profile-menu";
import { MobileTabBar, MobileTabContent, mobileTabClassName } from "./mobile-tab-bar";

type NavigationContextValue = {
  audience: NavigationAudience;
  currentRole?: Role | null;
  isAuthenticated: boolean;
};

const NavigationContext = createContext<NavigationContextValue>({
  audience: "guest",
  currentRole: null,
  isAuthenticated: false,
});

type NavigationProps = {
  children: React.ReactNode;
  currentRole?: Role | null;
  isAuthenticated?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  hasAdminAccess?: boolean;
};

function NavigationLink({ item, pathname, compact = false }: { item: NavigationItem; pathname: string; compact?: boolean }) {
  const active = isNavigationItemActive(item, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={compact ? item.label : undefined}
      title={compact ? item.label : undefined}
      className={cn(
        "group relative flex min-h-11 items-center gap-3 rounded-xl border border-transparent px-3 text-sm font-semibold outline-none transition-[background-color,border-color,color] duration-200 focus-visible:ring-2 focus-visible:ring-ring",
        compact && "size-11 justify-center p-0",
        active
          ? "border-forest/15 bg-accent text-forest"
          : "text-muted-foreground hover:border-border hover:bg-muted hover:text-ink",
      )}
    >
      <Icon className="size-[1.125rem] shrink-0" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
      {compact ? null : <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function DesktopSidebar({ audience, pathname }: { audience: NavigationAudience; pathname: string }) {
  const items = primaryNavigationFor(audience);
  const isLandlord = audience === "landlord";

  return (
    <aside className="fixed inset-y-0 left-0 z-[var(--z-chrome)] hidden w-64 flex-col border-r border-border bg-panel md:flex">
      <Link href="/" className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" aria-hidden="true" width={28} height={28} className="size-7" />
        <span className="text-lg font-bold tracking-tight">Pinpoints</span>
      </Link>

      <nav aria-label={isLandlord ? "Landlord workspace" : "Renter workspace"} className="flex min-h-0 flex-1 flex-col px-3 py-5">
        <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {isLandlord ? "Landlord workspace" : "Renter workspace"}
        </p>
        <div className="space-y-1">
          {items.map((item) => <NavigationLink key={item.id} item={item} pathname={pathname} />)}
        </div>

        {isLandlord ? (
          <Link
            href="/dashboard/listings/new"
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-semibold text-primary-foreground outline-none transition-colors hover:bg-forest/90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-4" aria-hidden="true" />
            New listing
          </Link>
        ) : null}

        <div className="mt-auto border-t border-border pt-4">
          <Link href="/" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground outline-none hover:bg-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-ring">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Explore the map
          </Link>
        </div>
      </nav>
    </aside>
  );
}

function MobileBottomNavigation({ audience, pathname }: { audience: NavigationAudience; pathname: string }) {
  const items = primaryNavigationFor(audience);

  return (
    <MobileTabBar
      dataMobileNavigation
      label={audience === "landlord" ? "Landlord primary navigation" : "Renter primary navigation"}
      itemCount={items.length}
    >
      {items.map((item) => {
        const active = isNavigationItemActive(item, pathname);
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={mobileTabClassName(active)}
          >
            <MobileTabContent active={active} icon={item.icon} label={item.label} />
          </Link>
        );
      })}
    </MobileTabBar>
  );
}

function PublicHeader({ pathname, profileMenu }: { pathname: string; profileMenu: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-[var(--z-chrome)] flex min-h-16 items-center border-b border-border bg-panel px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-5">
        <Link href="/" aria-label="Pinpoints home" className="flex min-h-11 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" aria-hidden="true" width={26} height={26} className="size-6.5" />
          <span className="font-bold tracking-tight text-ink">Pinpoints</span>
        </Link>
        <nav aria-label="Public navigation" className="hidden min-w-0 flex-1 items-center gap-1 sm:flex">
          {publicNavigation.map((item) => <NavigationLink key={item.id} item={item} pathname={pathname} />)}
        </nav>
        <div className="ml-auto">{profileMenu}</div>
      </div>
    </header>
  );
}

export function DiscoveryPrimaryNavigation({ className }: { className?: string }) {
  const pathname = usePathname();
  const { audience, isAuthenticated } = useContext(NavigationContext);
  if (!isAuthenticated) return null;

  const items = primaryNavigationFor(audience).filter((item) => item.discovery);
  return (
    <nav aria-label="Primary navigation" className={cn("hidden items-center gap-1 lg:flex", className)}>
      {items.map((item) => (
        <div key={item.id} className={cn(item.discovery === "wide" && "hidden 2xl:block")}>
          <NavigationLink item={item} pathname={pathname} compact />
        </div>
      ))}
      {audience === "landlord" ? (
        <Link
          href="/dashboard/listings/new"
          aria-label="Add listing"
          title="Add listing"
          className="ml-1 inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-forest text-sm font-semibold text-primary-foreground outline-none transition-[background-color,transform] duration-200 hover:bg-forest/90 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring xl:w-auto xl:px-3.5"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden xl:inline">Add listing</span>
        </Link>
      ) : null}
    </nav>
  );
}

export function Navigation({
  children,
  currentRole,
  isAuthenticated = false,
  userName,
  userEmail,
  hasAdminAccess,
}: NavigationProps) {
  const pathname = usePathname();
  const audience = navigationAudience(isAuthenticated, currentRole);
  const focused = isFocusedNavigationRoute(pathname);
  const admin = pathname.startsWith("/admin");
  const workspace = !focused && !admin && isAuthenticated && isUserWorkspaceRoute(pathname);
  const publicHeader = !focused && !admin && isPublicContentRoute(pathname);
  const showMobileNavigation = !focused && !admin && isAuthenticated;
  const showFloatingProfile = !focused && !admin && !publicHeader;

  useEffect(() => {
    document.body.dataset.mobileNav = showMobileNavigation ? "visible" : "hidden";
    return () => {
      delete document.body.dataset.mobileNav;
    };
  }, [showMobileNavigation]);

  const profileMenu = (
    <ProfileMenu
      isAuthenticated={isAuthenticated}
      userName={userName}
      userEmail={userEmail}
      currentRole={currentRole}
      hasAdminAccess={hasAdminAccess}
      className="relative shrink-0"
    />
  );

  return (
    <NavigationContext.Provider value={{ audience, currentRole, isAuthenticated }}>
      {workspace ? <DesktopSidebar audience={audience} pathname={pathname} /> : null}
      <div className={cn("flex min-h-0 flex-1 flex-col", workspace && "md:pl-64")}>
        {publicHeader ? <PublicHeader pathname={pathname} profileMenu={profileMenu} /> : null}
        {children}
      </div>
      {showMobileNavigation ? <MobileBottomNavigation audience={audience} pathname={pathname} /> : null}
      {showFloatingProfile ? (
        <div className="pointer-events-auto fixed right-4 top-[calc(var(--mobile-safe-top)+0.5rem)] z-[100] isolate lg:right-6 lg:top-4">
          {profileMenu}
        </div>
      ) : null}
    </NavigationContext.Provider>
  );
}
