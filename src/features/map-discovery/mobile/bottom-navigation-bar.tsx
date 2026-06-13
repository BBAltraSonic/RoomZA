"use client";

// Bottom_Navigation_Bar for the Mobile_Map_Discovery feature.
// See .kiro/specs/mobile-map-discovery/design.md (BottomNavigationBar) and
// requirements.md (Req 7, 9.4, 9.6).

import Link from "next/link";
import { Compass, Heart, List, User, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { NAV_ROUTES, resolveActiveNav } from "../lib/nav";
import type { NavKey } from "../lib/types";

type NavItem = {
  key: NavKey;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: readonly NavItem[] = [
  { key: "discovery", label: "Discovery", icon: Compass },
  { key: "list", label: "List", icon: List },
  { key: "saved", label: "Saved", icon: Heart },
  { key: "profile", label: "Profile", icon: User },
];

export type BottomNavigationBarProps = {
  activeNav?: NavKey | null;
  onNavigate?: (key: NavKey) => void;
  className?: string;
  /**
   * "floating" (default) — fixed to the bottom of the viewport, used by the
   * mobile shell.
   * "docked" — static positioning, used when the caller places the bar inside
   * a positioned container (e.g. the desktop map column).
   */
  variant?: "floating" | "docked";
};

export function BottomNavigationBar({
  activeNav = null,
  onNavigate,
  className,
  variant = "floating",
}: BottomNavigationBarProps) {
  const active = resolveActiveNav(activeNav);

  const isFloating = variant === "floating";

  return (
    <div
      className={cn(
        "flex justify-center pointer-events-none",
        isFloating
          ? "fixed inset-x-0 bottom-0 z-[var(--z-chrome)]"
          : "absolute inset-x-0 bottom-0 z-[var(--z-controls)] pb-4",
        className,
      )}
      style={isFloating ? { paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)" } : undefined}
    >
      <nav
        aria-label="Primary"
        className="pointer-events-auto flex items-center justify-between rounded-[32px] bg-panel px-2 py-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-[92%] max-w-[420px]"
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
                "group relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 outline-none transition-transform active:scale-95",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive ? "text-forest" : "text-muted-foreground hover:text-ink",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-9 items-center justify-center rounded-full px-4 transition-all duration-300",
                  isActive ? "bg-accent text-forest" : "bg-transparent",
                )}
              >
                <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span className={cn("text-[11px] font-medium leading-none", isActive ? "text-forest" : "text-muted-foreground")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
