"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Ellipsis, LogOut, X } from "lucide-react";

import {
  adminNavigationGroups,
  isNavigationItemActive,
  type NavigationItem,
} from "@/components/navigation/navigation-config";
import { MobileTabBar, MobileTabContent, mobileTabClassName } from "@/components/navigation/mobile-tab-bar";
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
        active ? "border-forest/15 bg-accent text-forest" : "text-muted-foreground hover:border-border hover:bg-muted hover:text-ink",
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
          Back to Pinpoints
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

function AdminMoreMenu({ open, onClose, pathname, isOwner, triggerRef }: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  isOwner: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        triggerRef.current?.focus();
        return;
      }

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
      );
      if (!focusable.length) return;
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        focusable[(currentIndex + delta + focusable.length) % focusable.length]?.focus();
        return;
      }

      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        focusable[event.key === "Home" ? 0 : focusable.length - 1]?.focus();
        return;
      }

      if (event.key === "Tab") {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, triggerRef]);

  if (!open) return null;
  return (
    <>
      <button type="button" aria-label="Close admin menu" onClick={onClose} className="fixed inset-0 z-[calc(var(--z-nav-menu)+1)] bg-ink/20 md:hidden" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="All admin sections"
        className="fixed inset-x-0 bottom-[calc(var(--mobile-bottom-nav-h)+var(--mobile-safe-bottom))] z-[calc(var(--z-nav-menu)+2)] mx-auto max-h-[75dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl border-x border-t border-border bg-panel px-3 pb-5 pt-2 shadow-[var(--elevation-3)] md:hidden"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-panel px-2 pb-2 pt-1">
          <h2 className="text-base font-semibold text-ink">All admin sections</h2>
          <button type="button" onClick={() => { onClose(); triggerRef.current?.focus(); }} aria-label="Close admin menu" className="flex size-11 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {adminNavigationGroups.map((group) => {
          const items = group.items.filter((item) => !item.ownerOnly || isOwner);
          return (
            <section key={group.label} className="mb-4 last:mb-0">
              <h3 className="px-3 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.label}</h3>
              <div className="space-y-0.5">{items.map((item) => <AdminLink key={item.id} item={item} pathname={pathname} onNavigate={onClose} />)}</div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function MobileAdminNavigation({ pathname, isOwner }: { pathname: string; isOwner: boolean }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const coreItems = adminNavigationGroups.flatMap((group) => group.items).filter((item) => item.placement === "admin-core");
  const moreActive = !coreItems.some((item) => isNavigationItemActive(item, pathname));

  return (
    <>
      <MobileTabBar label="Admin primary navigation" itemCount={coreItems.length + 1}>
        {coreItems.map((item) => {
          const active = isNavigationItemActive(item, pathname);
          return (
            <Link key={item.id} href={item.href} aria-label={item.label} aria-current={active ? "page" : undefined} className={mobileTabClassName(active)}>
              <MobileTabContent active={active} icon={item.icon} label={item.label} />
            </Link>
          );
        })}
        <button ref={moreTriggerRef} type="button" aria-label="More" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)} className={mobileTabClassName(moreActive)}>
          <MobileTabContent active={moreActive} icon={Ellipsis} label="More" />
        </button>
      </MobileTabBar>
      <AdminMoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} pathname={pathname} isOwner={isOwner} triggerRef={moreTriggerRef} />
    </>
  );
}

export function AdminNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  return (
    <>
      <DesktopAdminNavigation pathname={pathname} isOwner={isOwner} />
      <MobileAdminNavigation pathname={pathname} isOwner={isOwner} />
    </>
  );
}
