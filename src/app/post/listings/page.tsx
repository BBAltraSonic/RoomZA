import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLinks } from "@/features/marketplace/category-links";
import { requireUser } from "@/lib/auth";
export const metadata: Metadata = { title: "My listings", robots: { index: false, follow: false } };

export default async function MyListingsPage() {
  await requireUser({ redirectTo: "/post/listings" });
  return <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-10">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2"><h1 className="text-3xl font-semibold">My listings</h1>
        <p className="text-sm text-muted-foreground">Manage your drafts, submissions, and published listings by category.</p>
      </div>
      <Link href="/post" className="inline-flex min-h-11 items-center rounded-lg bg-forest px-4 text-sm font-semibold text-primary-foreground">Create listing</Link>
    </header>
    <CategoryLinks intent="manage" />
  </main>;
}
