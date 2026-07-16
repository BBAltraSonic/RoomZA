"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BellRing,
  BookOpenText,
  Building2,
  CalendarDays,
  ClipboardList,
  FileWarning,
  Gauge,
  History,
  ShieldCheck,
  LogOut,
  ArrowLeft,
  UserCog,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

type AdminNavItem = { href: string; label: string; icon: typeof Gauge; ownerOnly?: boolean };

const items: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: Gauge },
  { href: "/admin/inbox", label: "Inbox", icon: BellRing },
  { href: "/admin/reports", label: "Reports", icon: FileWarning },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/listings", label: "Listings", icon: Building2 },
  { href: "/admin/blog", label: "Blog", icon: BookOpenText },
  { href: "/admin/applications", label: "Applications", icon: ClipboardList },
  { href: "/admin/viewings", label: "Viewings", icon: CalendarDays },
  { href: "/admin/operations", label: "Operations", icon: Activity },
  { href: "/admin/audit", label: "Audit", icon: History },
  { href: "/admin/settings/admins", label: "Admin members", icon: UserCog, ownerOnly: true },
  { href: "/admin/security", label: "Security", icon: ShieldCheck },
];

export function AdminNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin workspace" className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:overflow-visible md:px-3 md:py-5">
      {items.filter((item) => !item.ownerOnly || isOwner).map((item) => {
        const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:w-full",
              active ? "bg-accent text-forest shadow-[var(--neu-inset-sm)]" : "text-muted-foreground hover:bg-muted hover:text-ink",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
      <div className="hidden flex-1 md:block" />
      <Link href="/" className="hidden h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-ink md:flex"><ArrowLeft className="size-4" />Back to Pinpoints</Link>
      <form action="/auth/sign-out" method="post" className="hidden md:block"><button className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-ink"><LogOut className="size-4" />Sign out</button></form>
    </nav>
  );
}
