"use client";

import Link from "next/link";
import { authPathForRedirect } from "@/lib/redirects";
import { isNavigationItemActive, primaryNavigationFor, type NavigationAudience } from "./navigation-config";
import { useDiscoveryAccount } from "./navigation-account-context";
import { PinpointBrandLink, PinpointChrome, PinpointHeaderActions } from "./pinpoint-chrome";
import { cn } from "@/lib/utils";
import styles from "./pinpoint-chrome.module.css";

/** Guests see the same destinations; anything past Explore needs an account, so it goes through sign-in first. */
const hrefFor = (href: string, audience: NavigationAudience) => audience !== "guest" || href === "/" ? href : authPathForRedirect(href);

export function WorkspaceNavigation({ audience, pathname, ariaLabel, className }: {
  audience: NavigationAudience; pathname: string; ariaLabel: string; className?: string;
}) {
  return <nav aria-label={ariaLabel} data-audience={audience} className={cn(styles.workspaceNavigation, className)}>
    {primaryNavigationFor(audience).map(item => {
      const Icon = item.icon;
      return <Link prefetch={false} key={item.id} href={hrefFor(item.href, audience)}
        aria-current={isNavigationItemActive(item, pathname) ? "page" : undefined}
        className={styles.workspaceLink}>
        <Icon className={styles.workspaceIcon} aria-hidden="true" /><span>{item.label}</span>
      </Link>;
    })}
  </nav>;
}

export function WorkspaceHeader({ pathname }: { pathname: string }) {
  const { audience, isAuthenticated, profileMenu } = useDiscoveryAccount();
  return <PinpointChrome variant="workspace" data-slot="workspace-header">
    <div className={styles.workspaceRow}>
      <PinpointBrandLink />
      <WorkspaceNavigation audience={audience} pathname={pathname} ariaLabel="Main navigation" />
      <PinpointHeaderActions profileMenu={profileMenu} showSaved={false}
        add={{ href: isAuthenticated ? "/post" : authPathForRedirect("/post"), label: "Create listing" }} />
    </div>
  </PinpointChrome>;
}
