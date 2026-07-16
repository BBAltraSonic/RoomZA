import type { MetadataRoute } from "next";
import { getPublishedBlogSitemapRows } from "@/features/blog/data";
import { getPublishedListingSitemapRows } from "@/features/listings/api";

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
            url: `${baseUrl}/blog`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.7,
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
        const listings = await getPublishedListingSitemapRows();
        listingPages = listings.map((listing) => ({
            url: `${baseUrl}/listing/${listing.id}`,
            lastModified: new Date(listing.updated_at),
            changeFrequency: "weekly" as const,
            priority: 0.8,
        }));
    } catch {
        // If Supabase is unavailable, return only static pages
    }

    let blogPages: MetadataRoute.Sitemap = [];
    try {
        const posts = await getPublishedBlogSitemapRows();
        blogPages = posts.map((post) => ({
            url: `${baseUrl}/blog/${post.slug}`,
            lastModified: new Date(post.updated_at),
            changeFrequency: "monthly" as const,
            priority: 0.6,
        }));
    } catch {
        // Keep the sitemap available while the content database is unavailable.
    }

    return [...staticPages, ...listingPages, ...blogPages];
}
