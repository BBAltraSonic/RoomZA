"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bell,
  Building2,
  CalendarDays,
  Compass,
  Heart,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  Sun,
  User,
  Users,
} from "lucide-react";

import { useOnClickOutside } from "@/lib/hooks/use-on-click-outside";
import type { Role } from "@/lib/roles";

type ProfileMenuProps = {
  isAuthenticated?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  className?: string;
  currentRole?: Role | null;
};

function preferredTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = localStorage.getItem("roomza-theme");
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Airbnb-style hamburger + avatar button that opens a dropdown menu with
 * navigation links, notifications, and sign-out. Designed to be rendered once
 * at the global layout level so it appears on every renter and workspace route.
 */
export function ProfileMenu({
  isAuthenticated = false,
  userName,
  userEmail,
  className,
  currentRole,
}: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => preferredTheme());
  const menuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(menuRef, () => setIsOpen(false));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const handleThemeToggle = useCallback(() => {
    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      localStorage.setItem("roomza-theme", nextTheme);
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
      document.documentElement.style.colorScheme = nextTheme;
      return nextTheme;
    });
  }, []);

  const handleSignOut = useCallback(() => {
    setIsOpen(false);
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/auth/sign-out";
    document.body.appendChild(form);
    form.submit();
  }, []);

  // Profile identity — mirrors the logic previously inlined in discovery-page.
  const profileDisplayName =
    userName?.trim() ||
    (userEmail ? userEmail.split("@")[0] : null) ||
    (isAuthenticated ? "Your account" : "Guest");
  const profileEmail =
    userEmail?.trim() || (isAuthenticated ? null : "Not signed in");
  const profileInitials =
    profileDisplayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?";

  const isLandlord = currentRole === "landlord";

  return (
    <div ref={menuRef} className={className}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Open menu"
        onClick={() => setIsOpen((open) => !open)}
        className="flex min-h-11 items-center gap-2 rounded-full border border-border/60 bg-warm-surface py-1 pl-3 pr-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="size-4 text-ink" />
        <div
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-forest ring-1 ring-forest/15"
        >
          {profileInitials}
        </div>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-[var(--z-nav-menu)] w-64 origin-top-right animate-in fade-in zoom-in-95 rounded-xl border border-border bg-panel p-1.5 shadow-[var(--elevation-2)]"
        >
          {/* Identity header */}
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-forest ring-1 ring-forest/15"
            >
              {profileInitials}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold leading-tight text-ink">
                {profileDisplayName}
              </span>
              {profileEmail ? (
                <span className="truncate text-xs text-muted-foreground">
                  {profileEmail}
                </span>
              ) : null}
            </div>
          </div>

          <div className="my-1 h-px bg-border" />

          {isLandlord ? (
            <>
              <Link
                href="/dashboard"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
              >
                <Building2 className="size-4" />
                Listings
              </Link>
              <Link
                href="/dashboard/listings/new"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
              >
                <Plus className="size-4" />
                New Listing
              </Link>
              <Link
                href="/dashboard/applicants"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
              >
                <Users className="size-4" />
                Applicants
              </Link>
              <Link
                href="/dashboard/viewings"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
              >
                <CalendarDays className="size-4" />
                Viewings
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/saved"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
              >
                <Heart className="size-4" />
                Saved
              </Link>
            </>
          )}

          <Link
            href="/messages"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
          >
            <MessageSquare className="size-4" />
            Messages
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              toast("No new notifications");
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
          >
            <Bell className="size-4" />
            Notifications
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={theme === "dark"}
            onClick={handleThemeToggle}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
          >
            <User className="size-4" />
            Profile
          </Link>
          
          <Link
            href="/"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
          >
            <Compass className="size-4" />
            Discovery
          </Link>

          {!isLandlord && (
            <Link
              href="/dashboard"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
            >
              <LayoutGrid className="size-4" />
              Dashboard
            </Link>
          )}

          <div className="my-1 h-px bg-border" />

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
