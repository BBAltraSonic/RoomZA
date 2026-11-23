import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PROPERTY_LISTINGS_HREF } from "@/features/marketplace/my-listings";

export const metadata: Metadata = { title: "My listings", robots: { index: false, follow: false } };

/** Property management now lives on My listings; keep old links and bookmarks working, filters included. */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const target = new URLSearchParams({ category: "property" });
  for (const key of ["q", "status", "sort"]) {
    const value = params[key];
    if (typeof value === "string" && value) target.set(key, value);
  }
  redirect(target.size > 1 ? `/post/listings?${target}` : PROPERTY_LISTINGS_HREF);
}
