"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  FileText,
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
  { name: "Applications", shortName: "Apps", href: "/applications", icon: FileText },
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
            <Icon className="size-4" strokeWidth={isActive ? 2.5 : 2} />
            <span className="hidden xl:inline">{item.name}</span>
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
};

export function Navigation({ currentRole, isAuthenticated, userName, userEmail }: NavigationProps) {
  const pathname = usePathname();

  const hiddenRoute =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
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
          <div className="flex h-16 shrink-0 items-center px-6">
            <span className="text-xl font-black tracking-tight text-forest">RoomZA</span>
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
                    <Icon className="size-4" strokeWidth={isActive ? 2.5 : 2} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      ) : null}

      {/* Global profile menu — fixed top-right on all pages (mobile & desktop) */}
      {showProfileMenu ? (
        <div className="fixed right-4 top-[calc(var(--mobile-safe-top)+0.5rem)] lg:top-4 z-[var(--z-chrome)] lg:right-6">
          <ProfileMenu
            isAuthenticated={isAuthenticated}
            userName={userName}
            userEmail={userEmail}
            currentRole={currentRole}
            className="relative shrink-0"
          />
        </div>
      ) : null}
    </>
  );
}
