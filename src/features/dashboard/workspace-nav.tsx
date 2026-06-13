"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarDays, MessageCircle, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Listings", icon: Building2 },
  { href: "/dashboard/applicants", label: "Applicants", icon: Users },
  { href: "/dashboard/viewings", label: "Viewings", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: MessageCircle },
];

export function WorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace" className="border-b border-border bg-panel">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 py-2 sm:px-6 lg:px-8">
        {items.map((item) => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active ? "bg-accent text-forest" : "hover:bg-muted hover:text-ink",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
