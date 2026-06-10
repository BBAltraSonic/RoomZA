"use client";

// Bottom_Navigation_Bar for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (BottomNavigationBar) and
// requirements.md (Req 7, 9.4, 9.6).

import Link from "next/link";
import { Compass, Heart, Home, List, User, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { NAV_ROUTES, resolveActiveNav } from "../lib/nav";
import type { NavKey } from "../lib/types";

type NavItem = {
  key: NavKey;
  /** Accessible name + visible label, equal to the destination (Req 7.7, 9.6). */
  label: string;
  icon: LucideIcon;
};

/** Five Nav_Buttons in left-to-right order: Home, Discovery, List, Saved, Profile (Req 7.2). */
const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "discovery", label: "Discovery", icon: Compass },
  // TODO: confirm "List" destination (Data Gap 4)
  { key: "list", label: "List", icon: List },
  { key: "saved", label: "Saved", icon: Heart },
  { key: "profile", label: "Profile", icon: User },
];

export type BottomNavigationBarProps = {
  /** Currently activated destination; Discovery is the default (Req 7.3). */
  activeNav?: NavKey | null;
  /** Notifies the caller when a destination is activated (caller wires routing/timing). */
  onNavigate?: (key: NavKey) => void;
  className?: string;
};

export function BottomNavigationBar({
  activeNav = null,
  onNavigate,
  className,
}: BottomNavigationBarProps) {
  // Exactly one active at a time; defaults to Discovery (Req 7.5, 7.6).
  const active = resolveActiveNav(activeNav);

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[var(--z-chrome)] flex items-stretch justify-around border-t border-border bg-panel",
        className,
      )}
      style={{
        height: "var(--mobile-bottom-nav-h)",
        paddingBottom: "var(--mobile-safe-bottom)",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.key === active;
        const Icon = item.icon;

        return (
          <Link
            key={item.key}
            href={NAV_ROUTES[item.key]}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onNavigate?.(item.key)}
            className={cn(
              "group relative flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
              isActive ? "text-forest" : "text-muted-foreground hover:text-ink",
            )}
          >
            {/* Non-color active indicator: persistent top pill (Req 9.4). */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-0 h-0.5 w-8 rounded-full transition-opacity",
                isActive ? "bg-forest opacity-100" : "opacity-0",
              )}
            />
            {/* Thicker/filled icon when active is a second non-color cue (Req 9.4). */}
            <Icon
              className="size-5"
              strokeWidth={isActive ? 2.75 : 2}
              fill={isActive ? "currentColor" : "none"}
            />
            {/* Persistent visible label so active state is color-independent (Req 9.4). */}
            <span className={cn(isActive && "font-semibold")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
