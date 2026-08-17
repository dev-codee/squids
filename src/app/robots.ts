import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/regions";

/**
 * Dynamic robots.txt file generator for Next.js.
 *
 * Allows search engines to index public store pages and categories while explicitly
 * restricting access to internal admin dashboards (/dashboard/), login (/admin/),
 * and API routes (/api/).
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/admin/", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
