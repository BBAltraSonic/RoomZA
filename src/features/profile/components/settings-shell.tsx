"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Link2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";

import { Input } from "@/components/ui/input";

const sections = [
  {
    id: "profile",
    label: "Profile",
    description: "Identity and preferences",
    icon: UserRound,
  },
  {
    id: "privacy",
    label: "Privacy & data",
    description: "Visibility, blocks, POPIA",
    icon: LockKeyhole,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Channel and frequency",
    icon: Bell,
  },
  {
    id: "security",
    label: "Security",
    description: "Password, MFA, devices",
    icon: ShieldCheck,
  },
  {
    id: "connections",
    label: "Connected accounts",
    description: "OAuth and passkeys",
    icon: Link2,
  },
  {
    id: "account",
    label: "Account management",
    description: "Exports and deletion",
    icon: Trash2,
  },
] as const;

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const visible = sections.filter((section) =>
    `${section.label} ${section.description}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <main className="min-h-dvh bg-background px-4 pb-[calc(var(--app-mobile-nav-offset)+2rem)] pt-6 text-foreground sm:px-6 lg:pt-8">
      <div className="mx-auto grid w-full grid-cols-1 max-w-7xl gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-ink">
            Account controls
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
            Settings
          </h1>
          <label className="relative mt-5 block">
            <span className="sr-only">Search settings</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search settings"
              className="h-11 pl-10"
            />
          </label>
          <nav
            aria-label="Settings sections"
            className="mt-4 flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible"
          >
            {visible.map(({ id, label, description, icon: Icon }) => {
              const active = pathname.endsWith(`/settings/${id}`);
              return (
                <Link
                  key={id}
                  href={`/settings/${id}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 shrink-0 items-center gap-3 rounded-xl px-4 outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-selection text-selection-foreground" : "text-muted-foreground hover:bg-muted hover:text-ink"}`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="hidden text-xs font-normal lg:block">
                      {description}
                    </span>
                  </span>
                </Link>
              );
            })}
            {visible.length === 0 ? <p role="status" className="py-4 text-sm text-muted-foreground">No sections match. Try privacy, notifications, or security.</p> : null}
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
