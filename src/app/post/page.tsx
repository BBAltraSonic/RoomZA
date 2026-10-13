import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLinks } from "@/features/marketplace/category-links";
import { requireUser } from "@/lib/auth";
export const metadata: Metadata = { title: "Create listing", robots: { index: false, follow: false } };

export default async function CreateListingPage() {
  await requireUser({ redirectTo: "/post" });
  return <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-10">
    <header className="space-y-2">
      <h1 className="text-3xl font-semibold">Create listing</h1>
      <p className="text-sm text-muted-foreground">Choose what you want to list. You can browse and list using the same account.</p>
    </header>
    <CategoryLinks intent="create" />
    <Link href="/post/listings" className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline">My listings</Link>
  </main>;
}
