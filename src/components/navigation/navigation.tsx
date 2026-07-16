"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as m from "motion/react-m";
import {
  Building2,
  CalendarDays,
  Compass,
  Heart,
  Map,
  MessageCircle,
  Plus,
  User,
  Users,
} from "lucide-react";

import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { ProfileMenu } from "./profile-menu";

const renterItems = [
  { name: "Explore", shortName: "Explore", href: "/", icon: Map },
  { name: "Saved", shortName: "Saved", href: "/saved", icon: Heart },
  { name: "Journey", shortName: "Journey", href: "/journey", icon: Compass },
  { name: "Messages", shortName: "Inbox", href: "/messages", icon: MessageCircle },
  { name: "Profile", shortName: "Profile", href: "/profile", icon: User },
];

const workspaceItems = [
  { name: "Listings", shortName: "Listings", href: "/dashboard", icon: Building2 },
  { name: "New listing", shortName: "New", href: "/dashboard/listings/new", icon: Plus },
  { name: "Applicants", shortName: "Apps", href: "/dashboard/applicants", icon: Users },
  { name: "Viewings", shortName: "Views", href: "/dashboard/viewings", icon: CalendarDays },
  { name: "Messages", shortName: "Inbox", href: "/messages", icon: MessageCircle },
  { name: "Profile", shortName: "Profile", href: "/profile", icon: User },
];

type NavigationTabsProps = {
  onNavigate?: () => void;
  className?: string;
  currentRole?: Role | null;
};



export function NavigationTabs({ onNavigate, className, currentRole }: NavigationTabsProps) {
  const pathname = usePathname();
  const items = currentRole === "landlord" ? workspaceItems : renterItems;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {items.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-shadow",
              "text-muted-foreground hover:text-ink hover:shadow-[var(--neu-raised-sm)]",
              isActive && "text-forest shadow-[var(--neu-inset-sm)]",
            )}
          >
            {isActive ? <m.span layoutId="renter-navigation-active" className="absolute inset-0 rounded-lg bg-accent/70" /> : null}
            <Icon className="relative z-10 size-4" strokeWidth={isActive ? 2.5 : 2} />
            <span className="relative z-10 hidden xl:inline">{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}

type NavigationProps = {
  currentRole?: Role | null;
  isAuthenticated?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  hasAdminAccess?: boolean;
};

export function Navigation({ currentRole, isAuthenticated, userName, userEmail, hasAdminAccess }: NavigationProps) {
  const pathname = usePathname();

  const hiddenRoute =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/account-suspended") ||
    /^\/messages\/[^/]+/.test(pathname);
  const isWorkspace = pathname.startsWith("/dashboard");
  const items = isWorkspace || currentRole === "landlord" ? workspaceItems : renterItems;

  useEffect(() => {
    if (hiddenRoute) {
      document.body.dataset.mobileNav = "hidden";
    } else {
      document.body.dataset.mobileNav = "visible";
    }

    return () => {
      delete document.body.dataset.mobileNav;
    };
  }, [hiddenRoute]);

  if (hiddenRoute) return null;

  // Show the global profile menu on all routes (renter & workspace).
  const showProfileMenu = !hiddenRoute;

  return (
    <>
      {isWorkspace ? (
        <nav className="fixed inset-y-0 left-0 z-[var(--z-chrome)] hidden w-64 flex-col bg-panel shadow-[var(--neu-raised)] md:flex">
          <div className="flex h-16 shrink-0 items-center gap-2 px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" aria-hidden="true" width={28} height={28} className="size-7" />
            <span className="text-xl font-black tracking-tight text-forest">Pinpoints</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="flex flex-col gap-1.5">
              {items.map((item) => {
                const isActive = item.href === "/dashboard" ? pathname === item.href : (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-shadow",
                      isActive ? "text-forest shadow-[var(--neu-inset-sm)]" : "text-muted-foreground hover:text-ink hover:shadow-[var(--neu-raised-sm)]",
                    )}
                  >
                    {isActive ? <m.span layoutId="workspace-navigation-active" className="absolute inset-0 rounded-lg bg-accent/70" /> : null}
                    <Icon className="relative z-10 size-4" strokeWidth={isActive ? 2.5 : 2} />
                    <span className="relative z-10">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      ) : null}

      {/* Global profile menu — fixed top-right on all pages (mobile & desktop) */}
      {showProfileMenu ? (
        <div className="pointer-events-auto fixed right-4 top-[calc(var(--mobile-safe-top)+0.5rem)] z-[100] isolate lg:right-6 lg:top-4">
          <ProfileMenu
            isAuthenticated={isAuthenticated}
            userName={userName}
            userEmail={userEmail}
            currentRole={currentRole}
            hasAdminAccess={hasAdminAccess}
            className="relative shrink-0"
          />
        </div>
      ) : null}
    </>
  );
}
