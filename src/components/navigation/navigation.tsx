"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/roles";
import { navigationAudience, navigationSurface } from "./navigation-config";
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
    <PinpointHeaderActions showSaved={false} showNotifications={false}
      add={{ href: "/post", label: "Create listing" }} />
  </>;
}

export function Navigation({
  children, currentRole, isAuthenticated = false, userName, userEmail, hasAdminAccess, status,
}: NavigationProps) {
  const pathname = usePathname();
  const audience = navigationAudience(isAuthenticated, currentRole);
  const surface = navigationSurface(pathname);

  useEffect(() => {
    document.body.dataset.mobileNav = "hidden";
    return () => { delete document.body.dataset.mobileNav; };
  }, []);

  const profileMenu = status === "loading" ? <span role="status" aria-label="Loading account" className="relative block size-11 shrink-0 animate-pulse rounded-full bg-muted motion-reduce:animate-none" /> : <ProfileMenu isAuthenticated={isAuthenticated} userName={userName} userEmail={userEmail}
    currentRole={currentRole} hasAdminAccess={hasAdminAccess} className="relative shrink-0" compact />;

  return <NavigationContext.Provider value={{ audience, currentRole, isAuthenticated, profileMenu }}>
    <div className="flex min-h-0 flex-1 flex-col">
      {surface === "workspace" ? <WorkspaceHeader pathname={pathname} /> : null}
      {children}
    </div>
  </NavigationContext.Provider>;
}
