"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";
import { useUnreadMessageCount } from "@/features/chat/unread-messages";
import { useNotifications } from "@/features/notifications/notification-provider";
import { cn } from "@/lib/utils";
import { navigationAudience, navigationSurface, showsMobilePrimaryNavigation } from "./navigation-config";
import { MobilePrimaryNavigation } from "./mobile-primary-navigation";
import { NavigationContext, useDiscoveryAccount } from "./navigation-account-context";
import { ProfileMenu } from "./profile-menu";
import { WorkspaceHeader, WorkspaceNavigation } from "./workspace-header";
import { PinpointHeaderActions } from "./pinpoint-chrome";

export { useDiscoveryAccount } from "./navigation-account-context";

type NavigationProps = {
  children: React.ReactNode;
  currentRole?: Role | null;
  isAuthenticated?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  hasAdminAccess?: boolean;
  status?: "loading" | "guest" | "authenticated";
};

/** Retained for callers embedding workspace destinations inside discovery chrome. */
export function DiscoveryPrimaryNavigation({ className, ariaLabel = "Primary navigation" }: {
  className?: string; ariaLabel?: string;
}) {
  const pathname = usePathname();
  const { audience, isAuthenticated } = useDiscoveryAccount();
  if (!isAuthenticated) return null;
  return <>
    <WorkspaceNavigation audience={audience} pathname={pathname} ariaLabel={ariaLabel} className={className} />
    <PinpointHeaderActions showSaved={false} showMessages={false} showNotifications={false}
      add={{ href: "/post", label: "Create listing" }} />
  </>;
}

export function Navigation({
  children, currentRole, isAuthenticated = false, userName, userEmail, hasAdminAccess, status,
}: NavigationProps) {
  const pathname = usePathname();
  const audience = navigationAudience(isAuthenticated, currentRole);
  const surface = navigationSurface(pathname);
  const showMobileNavigation = showsMobilePrimaryNavigation(pathname);
  const live = useNotifications();
  // Only screens with the dock (which include every discovery header) show a Messages badge.
  // New message notifications change the notification count, so it doubles as a refresh signal.
  const unreadMessages = useUnreadMessageCount(isAuthenticated && showMobileNavigation, `${pathname}|${live?.unreadCount ?? 0}`);

  useEffect(() => {
    document.body.dataset.mobileNav = showMobileNavigation ? "visible" : "hidden";
    return () => { delete document.body.dataset.mobileNav; };
  }, [showMobileNavigation]);

  // On phones the bottom dock's account circle replaces the header's profile circle.
  // Important (`!`) because the header's CSS module sets `.actions > div { display: flex }`.
  const headerAccountVisibility = showMobileNavigation ? "max-lg:hidden!" : undefined;
  const profileMenu = status === "loading" ? <span role="status" aria-label="Loading account" className={cn("relative block size-11 shrink-0 animate-pulse rounded-full bg-muted motion-reduce:animate-none", headerAccountVisibility)} /> : <ProfileMenu isAuthenticated={isAuthenticated} userName={userName} userEmail={userEmail}
    currentRole={currentRole} hasAdminAccess={hasAdminAccess} className={cn("relative shrink-0", headerAccountVisibility)} compact />;

  return <NavigationContext.Provider value={{ audience, currentRole, isAuthenticated, profileMenu, unreadMessages }}>
    <div className="flex min-h-0 flex-1 flex-col pb-[var(--app-mobile-nav-offset)]">
      {surface === "workspace" ? <WorkspaceHeader pathname={pathname} /> : null}
      {children}
      {showMobileNavigation ? <MobilePrimaryNavigation pathname={pathname} isAuthenticated={isAuthenticated} unreadMessages={unreadMessages}
        accountMenu={status === "loading"
          ? <span role="status" aria-label="Loading account" className="flex size-full items-center justify-center"><span className="block size-9 animate-pulse rounded-full bg-muted motion-reduce:animate-none" /></span>
          : <ProfileMenu placement="dock" isAuthenticated={isAuthenticated} userName={userName} userEmail={userEmail}
            currentRole={currentRole} hasAdminAccess={hasAdminAccess} className="size-full" />} /> : null}
    </div>
  </NavigationContext.Provider>;
}
