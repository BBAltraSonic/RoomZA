import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roomza.co.za";

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 1,
        },
        {
            url: `${baseUrl}/auth`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.3,
        },
        {
            url: `${baseUrl}/privacy`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.2,
        },
        {
            url: `${baseUrl}/terms`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.2,
        },
    ];

    // Dynamic listing pages
    let listingPages: MetadataRoute.Sitemap = [];
    try {
        const supabase = await createClient();
        const { data: listings } = await supabase
            .from("listings")
            .select("id, updated_at")
            .eq("status", "published")
            .order("updated_at", { ascending: false });

        if (listings) {
            listingPages = listings.map((listing) => ({
                url: `${baseUrl}/listing/${listing.id}`,
                lastModified: new Date(listing.updated_at),
                changeFrequency: "weekly" as const,
                priority: 0.8,
            }));
        }
    } catch {
        // If Supabase is unavailable, return only static pages
    }

    return [...staticPages, ...listingPages];
}
