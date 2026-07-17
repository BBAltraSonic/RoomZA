"use client";

import {
  type FocusEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
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
  ShieldCheck,
  Settings,
  ShieldQuestion,
} from "lucide-react";

import { useOnClickOutside } from "@/lib/hooks/use-on-click-outside";
import type { Role } from "@/lib/roles";

type ProfileMenuProps = {
  isAuthenticated?: boolean;
  userName?: string | null;
  userEmail?: string | null;
  className?: string;
  currentRole?: Role | null;
  hasAdminAccess?: boolean;
};

type ThemeMode = "light" | "dark";
type MenuFocusTarget = "first" | "last";

const MENU_ITEM_SELECTOR =
  '[role="menuitem"]:not([aria-disabled="true"]), [role="menuitemcheckbox"]:not([aria-disabled="true"])';

const menuItemClassName =
  "flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function getMenuItems(menu: HTMLElement | null) {
  if (!menu) return [];

  return Array.from(menu.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)).filter(
    (item) => !item.hasAttribute("disabled") && item.tabIndex !== -1,
  );
}

function preferredTheme(): ThemeMode {
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
  hasAdminAccess = false,
}: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => preferredTheme());
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingFocusRef = useRef<MenuFocusTarget | null>(null);
  const reactId = useId();
  const stableId = reactId.replace(/:/g, "");
  const triggerId = `profile-menu-trigger-${stableId}`;
  const menuId = `profile-menu-${stableId}`;

  const closeMenu = useCallback((restoreTriggerFocus = false) => {
    pendingFocusRef.current = null;
    setIsOpen(false);

    if (restoreTriggerFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  const handleOutsideClick = useCallback(() => {
    closeMenu();
  }, [closeMenu]);

  useOnClickOutside(rootRef, handleOutsideClick);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (!isOpen || !pendingFocusRef.current) return;

    const items = getMenuItems(menuRef.current);
    const item =
      pendingFocusRef.current === "first" ? items[0] : items[items.length - 1];

    pendingFocusRef.current = null;
    item?.focus();
  }, [isOpen]);

  const openMenu = useCallback((focusTarget?: MenuFocusTarget) => {
    pendingFocusRef.current = focusTarget ?? null;
    setIsOpen(true);
  }, []);

  const handleThemeToggle = useCallback(() => {
    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      localStorage.setItem("roomza-theme", nextTheme);
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
      document.documentElement.style.colorScheme = nextTheme;
      return nextTheme;
    });
    closeMenu();
  }, [closeMenu]);

  const handleSignOut = useCallback(() => {
    closeMenu();
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/auth/sign-out";
    document.body.appendChild(form);
    form.submit();
  }, [closeMenu]);

  const handleTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (isOpen) {
          getMenuItems(menuRef.current)[0]?.focus();
        } else {
          openMenu("first");
        }
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (isOpen) {
          const items = getMenuItems(menuRef.current);
          items[items.length - 1]?.focus();
        } else {
          openMenu("last");
        }
        return;
      }

      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        closeMenu(true);
      }
    },
    [closeMenu, isOpen, openMenu],
  );

  const handleMenuKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }

      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "Home" &&
        event.key !== "End"
      ) {
        return;
      }

      event.preventDefault();
      const items = getMenuItems(menuRef.current);
      if (items.length === 0) return;

      if (event.key === "Home") {
        items[0]?.focus();
        return;
      }

      if (event.key === "End") {
        items[items.length - 1]?.focus();
        return;
      }

      const activeIndex = items.indexOf(document.activeElement as HTMLElement);
      const nextIndex =
        event.key === "ArrowDown"
          ? activeIndex < 0
            ? 0
            : (activeIndex + 1) % items.length
          : activeIndex < 0
            ? items.length - 1
            : (activeIndex - 1 + items.length) % items.length;

      items[nextIndex]?.focus();
    },
    [closeMenu],
  );

  const handleRootBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (!isOpen) return;

      const nextFocusedElement = event.relatedTarget;
      if (
        nextFocusedElement instanceof Node &&
        rootRef.current?.contains(nextFocusedElement)
      ) {
        return;
      }

      closeMenu();
    },
    [closeMenu, isOpen],
  );

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
    <div ref={rootRef} className={className} onBlur={handleRootBlur}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        onClick={() => {
          pendingFocusRef.current = null;
          setIsOpen((open) => !open);
        }}
        onKeyDown={handleTriggerKeyDown}
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
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account menu"
          onKeyDown={handleMenuKeyDown}
          className="profile-menu-surface motion-menu absolute right-0 top-full z-[var(--z-nav-menu)] mt-2 max-h-[calc(100dvh-var(--mobile-safe-top)-4.5rem)] w-64 origin-top-right overflow-y-auto overscroll-contain rounded-xl border border-border bg-panel p-1.5 shadow-[var(--elevation-2)]"
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

          {hasAdminAccess ? (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => closeMenu()}
              className={menuItemClassName}
            >
              <ShieldCheck className="size-4" />
              Admin console
            </Link>
          ) : null}

          {isLandlord ? (
            <>
              <Link
                href="/dashboard"
                role="menuitem"
                onClick={() => closeMenu()}
                className={menuItemClassName}
              >
                <Building2 className="size-4" />
                Listings
              </Link>
              <Link
                href="/dashboard/listings/new"
                role="menuitem"
                onClick={() => closeMenu()}
                className={menuItemClassName}
              >
                <Plus className="size-4" />
                New Listing
              </Link>
              <Link
                href="/dashboard/applicants"
                role="menuitem"
                onClick={() => closeMenu()}
                className={menuItemClassName}
              >
                <Users className="size-4" />
                Applicants
              </Link>
              <Link
                href="/dashboard/viewings"
                role="menuitem"
                onClick={() => closeMenu()}
                className={menuItemClassName}
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
                onClick={() => closeMenu()}
                className={menuItemClassName}
              >
                <Heart className="size-4" />
                Saved
              </Link>
            </>
          )}

          <Link
            href="/messages"
            role="menuitem"
            onClick={() => closeMenu()}
            className={menuItemClassName}
          >
            <MessageSquare className="size-4" />
            Messages
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeMenu();
              toast("No new notifications");
            }}
            className={menuItemClassName}
          >
            <Bell className="size-4" />
            Notifications
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={theme === "dark"}
            onClick={handleThemeToggle}
            className={menuItemClassName}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => closeMenu()}
            className={menuItemClassName}
          >
            <User className="size-4" />
            Profile
          </Link>
          {isAuthenticated ? (
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => closeMenu()}
              className={menuItemClassName}
            >
              <Settings className="size-4" />
              Privacy and settings
            </Link>
          ) : null}
          <Link
            href="/trust"
            role="menuitem"
            onClick={() => closeMenu()}
            className={menuItemClassName}
          >
            <ShieldQuestion className="size-4" />
            Trust and safety
          </Link>
          
          <Link
            href="/"
            role="menuitem"
            onClick={() => closeMenu()}
            className={menuItemClassName}
          >
            <Compass className="size-4" />
            Discovery
          </Link>

          {!isLandlord && (
            <Link
              href="/dashboard"
              role="menuitem"
              onClick={() => closeMenu()}
              className={menuItemClassName}
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
            className={menuItemClassName}
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
