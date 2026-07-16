import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://roomza.co.za";

    return {
        rules: [
            {
                userAgent: "*",
                allow: ["/", "/listing/", "/blog", "/blog/"],
                disallow: [
                    "/dashboard/",
                    "/applications",
                    "/journey",
                    "/messages/",
                    "/onboarding",
                    "/auth/callback",
                    "/api/",
                    "/admin/",
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
