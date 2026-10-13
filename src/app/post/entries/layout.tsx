import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Your Places and Event entries", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function EntryWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 pb-28 sm:px-6 lg:py-10">
    <Link href="/post/entries" className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Your entries</Link>
    {children}
  </main>;
}
