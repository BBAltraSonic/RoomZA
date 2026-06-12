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
  Menu,
  MessageCircle,
  Plus,
  User,
  Users,
  X,
} from "lucide-react";

import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useState } from "react";

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

type MobileMenuButtonProps = {
  open: boolean;
  onToggle: () => void;
  className?: string;
};

export function MobileMenuButton({ open, onToggle, className }: MobileMenuButtonProps) {
  return (
    <button
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full bg-panel shadow-[var(--elevation-3)] transition-all active:scale-95",
        open ? "text-forest rotate-90" : "text-ink",
        className,
      )}
      onClick={onToggle}
      aria-label="Toggle navigation menu"
      aria-expanded={open}
    >
      {open ? <X className="size-5" /> : <Menu className="size-5" />}
    </button>
  );
}

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
              "group relative flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-warm-surface hover:text-ink",
              isActive && "bg-accent text-forest",
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

export function Navigation({ currentRole }: { currentRole?: Role | null }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hiddenRoute =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    /^\/messages\/[^/]+/.test(pathname);
  const isWorkspace = pathname.startsWith("/dashboard");
  const items = isWorkspace || currentRole === "landlord" ? workspaceItems : renterItems;

  const hideMobileHamburger = pathname === "/";

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

  return (
    <>
      {isWorkspace ? (
        <nav className="fixed inset-y-0 left-0 z-[var(--z-chrome)] hidden w-64 flex-col border-r border-border bg-panel md:flex">
          <div className="flex h-16 shrink-0 items-center border-b border-border px-6">
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
                      "group relative flex items-center justify-start gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
                      isActive ? "bg-accent text-forest" : "text-muted-foreground hover:bg-warm-surface hover:text-ink",
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

      {/* Mobile Hamburger Toggle & Overlay */}
      {!hideMobileHamburger && (
        <div className="fixed top-4 right-4 z-[9999] md:hidden">
          <MobileMenuButton
            open={mobileMenuOpen}
            onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          />
        </div>
      )}

      {mobileMenuOpen && !hideMobileHamburger && (
        <div className="fixed inset-0 z-[9998] md:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-md transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav className="absolute inset-x-0 top-0 flex flex-col items-center justify-center p-8 pt-24 bg-panel shadow-[var(--elevation-2)] animate-in slide-in-from-top-4 fade-in-20 duration-300">
            {items.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex w-full items-center justify-start gap-4 rounded-2xl p-4 text-lg font-medium transition-colors",
                    isActive
                      ? "bg-forest/10 text-forest"
                      : "text-muted-foreground hover:bg-warm-surface"
                  )}
                >
                  <div className={cn(
                    "flex size-10 items-center justify-center rounded-xl",
                    isActive ? "bg-forest/20" : "bg-muted"
                  )}>
                    <Icon className={cn("size-5", isActive ? "text-forest" : "text-ink")} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={cn(isActive && "font-semibold")}>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
