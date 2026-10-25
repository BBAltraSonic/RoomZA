"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgeCheck,
  FileText,
  LayoutDashboard,
  PencilLine,
  Star,
  Settings,
  ListChecks,
} from "lucide-react";

const links = [
  { href: "/profile", label: "Overview", icon: LayoutDashboard },
  { href: "/post/listings", label: "My listings", icon: ListChecks },
  { href: "/profile/edit", label: "Edit profile", icon: PencilLine },
  { href: "/profile/activity", label: "Activity", icon: Activity },
  { href: "/profile/documents", label: "Documents", icon: FileText },
  { href: "/profile/reviews", label: "Reviews", icon: Star },
  { href: "/profile/verification", label: "Verification", icon: BadgeCheck },
  { href: "/settings", label: "Account settings", icon: Settings },
] as const;

export function ProfileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main
      className="min-h-dvh bg-background px-4 pb-[calc(var(--app-mobile-nav-offset)+2rem)] text-foreground sm:px-6"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)" }}
    >
      <div className="mx-auto grid w-full grid-cols-1 max-w-7xl gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-forest"
          >
            Pinpoint
          </Link>
          <nav
            aria-label="Profile sections"
            className="-mx-4 mt-2 scrollbar-hide flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:mt-8 lg:flex-col lg:overflow-visible lg:px-0"
          >
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${pathname === href ? "bg-selection text-selection-foreground" : "text-muted-foreground hover:bg-muted hover:text-ink"}`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
