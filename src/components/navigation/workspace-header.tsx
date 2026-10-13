"use client";

import Link from "next/link";
import { authPathForRedirect } from "@/lib/redirects";
import { isNavigationItemActive, primaryNavigationFor, type NavigationAudience } from "./navigation-config";
import { useDiscoveryAccount } from "./navigation-account-context";
import { PinpointBrandLink, PinpointChrome, PinpointHeaderActions } from "./pinpoint-chrome";
import { cn } from "@/lib/utils";
import styles from "./pinpoint-chrome.module.css";

export function WorkspaceNavigation({ audience, pathname, ariaLabel, className }: {
  audience: NavigationAudience; pathname: string; ariaLabel: string; className?: string;
}) {
  return <nav aria-label={ariaLabel} data-audience={audience} className={cn(styles.workspaceNavigation, className)}>
    {primaryNavigationFor(audience).map(item => {
      const Icon = item.icon;
      return <Link prefetch={false} key={item.id} href={item.href}
        aria-current={isNavigationItemActive(item, pathname) ? "page" : undefined}
        className={styles.workspaceLink}>
        <Icon className={styles.workspaceIcon} aria-hidden="true" /><span>{item.label}</span>
      </Link>;
    })}
  </nav>;
}

export function WorkspaceHeader({ pathname }: { pathname: string }) {
  const { audience, isAuthenticated, profileMenu } = useDiscoveryAccount();
  const label = audience === "guest" ? "Public navigation" : "Account navigation";
  return <PinpointChrome variant="workspace" data-slot="workspace-header">
    <div className={styles.workspaceRow}>
      <PinpointBrandLink />
      <WorkspaceNavigation audience={audience} pathname={pathname} ariaLabel={label} />
      <PinpointHeaderActions profileMenu={profileMenu} showSaved={false} showNotifications={isAuthenticated}
        add={{ href: isAuthenticated ? "/post" : authPathForRedirect("/post"), label: "Create listing" }} />
    </div>
  </PinpointChrome>;
}
