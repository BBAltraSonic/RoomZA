"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";

import {
  adminNavigationGroups,
  isNavigationItemActive,
  type NavigationItem,
} from "@/components/navigation/navigation-config";
import { AdminMenuContext, useDiscoveryAccount } from "@/components/navigation/navigation-account-context";
import { PinpointBrandLink, PinpointChrome, PinpointHeaderActions } from "@/components/navigation/pinpoint-chrome";
import chrome from "@/components/navigation/pinpoint-chrome.module.css";
import { cn } from "@/lib/utils";

function AdminLink({ item, pathname, onNavigate }: { item: NavigationItem; pathname: string; onNavigate?: () => void }) {
  const active = isNavigationItemActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl border border-transparent px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-selection bg-selection text-selection-foreground" : "text-muted-foreground hover:border-border hover:bg-muted hover:text-ink",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

function DesktopAdminNavigation({ pathname, isOwner }: { pathname: string; isOwner: boolean }) {
  return (
    <nav aria-label="Admin workspace" className="hidden min-h-0 flex-1 overflow-y-auto px-3 py-4 md:block">
      {adminNavigationGroups.map((group) => {
        const items = group.items.filter((item) => !item.ownerOnly || isOwner);
        if (!items.length) return null;
        return (
          <section key={group.label} className="mb-5" aria-labelledby={`admin-nav-${group.label.replaceAll(" ", "-").toLowerCase()}`}>
            <h2 id={`admin-nav-${group.label.replaceAll(" ", "-").toLowerCase()}`} className="px-3 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {group.label}
            </h2>
            <div className="space-y-0.5">
              {items.map((item) => <AdminLink key={item.id} item={item} pathname={pathname} />)}
            </div>
          </section>
        );
      })}
      <div className="border-t border-border pt-3">
        <Link href="/" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground outline-none hover:bg-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Pinpoint
        </Link>
        <form action="/auth/sign-out" method="post">
          <button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground outline-none hover:bg-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-ring">
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}

export function AdminNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const { profileMenu } = useDiscoveryAccount();
  const access = useMemo(() => ({ isOwner }), [isOwner]);
  return (
    <>
      <DesktopAdminNavigation pathname={pathname} isOwner={isOwner} />
      <PinpointChrome variant="workspace" className="md:hidden" data-slot="admin-mobile-header">
        <div className={chrome.workspaceRow}>
          <PinpointBrandLink /><span className="text-sm font-semibold">Admin</span>
          <AdminMenuContext.Provider value={access}><PinpointHeaderActions profileMenu={profileMenu} showSaved={false} showNotifications={false} /></AdminMenuContext.Provider>
        </div>
      </PinpointChrome>
    </>
  );
}
