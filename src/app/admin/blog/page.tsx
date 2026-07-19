import type { Metadata } from "next";

import { AdminBlogPageContent } from "@/features/blog/components/admin-blog-page";

export const metadata: Metadata = { title: "Blog | Pinpoints admin", robots: { index: false, follow: false } };

export default async function AdminBlogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <AdminBlogPageContent params={await searchParams} />;
}
