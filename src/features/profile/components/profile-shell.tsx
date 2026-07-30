import Link from "next/link";
import {
  Activity,
  BadgeCheck,
  FileText,
  LayoutDashboard,
  PencilLine,
  Star,
} from "lucide-react";

const links = [
  { href: "/profile", label: "Overview", icon: LayoutDashboard },
  { href: "/profile/edit", label: "Edit profile", icon: PencilLine },
  { href: "/profile/activity", label: "Activity", icon: Activity },
  { href: "/profile/documents", label: "Documents", icon: FileText },
  { href: "/profile/reviews", label: "Reviews", icon: Star },
  { href: "/profile/verification", label: "Verification", icon: BadgeCheck },
] as const;

export function ProfileShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-dvh bg-background px-4 pb-[calc(var(--mobile-bottom-nav-h)+var(--mobile-safe-bottom)+1rem)] text-foreground sm:px-6 sm:pb-28"
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
            className="-mx-4 mt-2 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:mt-8 lg:flex-col lg:overflow-visible lg:px-0"
          >
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
          <Link
            href="/settings"
            className="mt-4 hidden min-h-11 items-center px-3 text-sm font-semibold text-forest lg:inline-flex"
          >
            Account settings
          </Link>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
