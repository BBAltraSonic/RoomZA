"use client";

import { createContext, useContext, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

import {
  isFocusedNavigationRoute,
  isNavigationItemActive,
  isPublicContentRoute,
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

export function DesktopGlobalHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="relative z-[var(--z-chrome)] hidden min-h-16 flex-none items-center gap-5 border-b border-border/40 bg-surface-chrome py-3 pl-9 pr-28 shadow-sm lg:flex">
      <Link
        href="/"
        aria-label="Pinpoints home"
        className="flex shrink-0 items-center gap-3 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-forest"
      >
        <BrandLogo />
      </Link>
      {children}
    </header>
  );
}

function AuthenticatedDesktopHeader({ audience }: { audience: NavigationAudience }) {
  return (
    <DesktopGlobalHeader>
      <div
        className="flex shrink-0 items-center gap-1 rounded-full border border-border/60 bg-warm-surface p-1"
        aria-label="Listing market"
      >
        <Link
          href="/"
          className="flex h-8 items-center rounded-full bg-panel px-3 text-sm font-semibold text-ink shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-forest"
        >
          Rent
        </Link>
        <Link
          href="/?mode=buy"
          className="flex h-8 items-center rounded-full px-3 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-forest"
        >
          Buy
        </Link>
      </div>

      <form
        action="/"
        role="search"
        className="flex min-w-44 flex-1 items-center gap-3 rounded-full border border-border/60 bg-warm-surface px-4 py-2 shadow-sm transition-colors focus-within:border-forest focus-within:ring-1 focus-within:ring-forest"
      >
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          name="q"
          aria-label="Search listings"
          placeholder="Search neighbourhood or city"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          className="hidden h-8 shrink-0 items-center justify-center rounded-full bg-forest px-3 text-xs font-semibold text-primary-foreground outline-none transition-colors hover:bg-forest/90 focus-visible:ring-2 focus-visible:ring-ring xl:flex"
        >
          Search
        </button>
      </form>

      <DiscoveryPrimaryNavigation
        className="flex"
        ariaLabel={audience === "landlord" ? "Landlord workspace" : "Renter workspace"}
      />
    </DesktopGlobalHeader>
  );
}

function PublicHeader({ pathname, profileMenu }: { pathname: string; profileMenu: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-[var(--z-chrome)] flex min-h-16 items-center border-b border-border bg-panel px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-5">
        <Link href="/" aria-label="Pinpoints home" className="flex min-h-11 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandLogo size={26} />
        </Link>
        <nav aria-label="Public navigation" className="hidden min-w-0 flex-1 items-center gap-1 sm:flex">
          {publicNavigation.map((item) => <NavigationLink key={item.id} item={item} pathname={pathname} />)}
        </nav>
        <div className="ml-auto">{profileMenu}</div>
      </div>
    </header>
  );
}

export function DiscoveryPrimaryNavigation({
  className,
  ariaLabel = "Primary navigation",
}: {
  className?: string;
  ariaLabel?: string;
}) {
  const pathname = usePathname();
  const { audience, isAuthenticated } = useContext(NavigationContext);
  if (!isAuthenticated) return null;

  const items = primaryNavigationFor(audience);
  return (
    <nav aria-label={ariaLabel} className={cn("hidden items-center gap-1 lg:flex", className)}>
      {items.map((item) => (
        <div key={item.id}>
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
  const publicContent = !focused && !admin && isPublicContentRoute(pathname);
  const publicHeader = publicContent && !isAuthenticated;
  const authenticatedDesktopHeader =
    !focused && !admin && isAuthenticated && pathname !== "/";
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
      <div className="flex min-h-0 flex-1 flex-col">
        {authenticatedDesktopHeader ? <AuthenticatedDesktopHeader audience={audience} /> : null}
        {publicHeader ? <PublicHeader pathname={pathname} profileMenu={profileMenu} /> : null}
        {children}
      </div>
      {showMobileNavigation ? <MobileBottomNavigation audience={audience} pathname={pathname} /> : null}
      {showFloatingProfile ? (
        <div className="pointer-events-auto fixed right-4 top-[calc(var(--mobile-safe-top)+1rem)] z-[100] isolate lg:right-6 lg:top-4">
          {profileMenu}
        </div>
      ) : null}
    </NavigationContext.Provider>
  );
}
