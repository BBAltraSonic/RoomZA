import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import chrome from "@/components/navigation/pinpoint-chrome.module.css";

import { AdminNav } from "@/features/admin/components/admin-nav";
import { requireAdminMembership } from "@/features/admin/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { membership } = await requireAdminMembership({ redirectTo: "/admin" });
  return (
    <div className="min-h-dvh bg-background text-foreground md:grid md:grid-cols-[256px_1fr]">
      <aside className={`${chrome.palette} contents bg-warm-surface md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:border-r md:border-border`}>
        <Link href="/admin" className="hidden h-16 items-center gap-2 border-b border-border px-5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex">
          <BrandLogo size={24} nameClassName="text-base" /><span className="text-sm font-semibold">admin</span>
        </Link>
        <AdminNav isOwner={membership.level === "owner"} />
      </aside>
      <main className="min-w-0 px-4 pb-[calc(var(--mobile-bottom-nav-h)+var(--mobile-safe-bottom)+1.5rem)] pt-6 sm:px-6 md:px-8 md:pb-10 lg:px-10">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
