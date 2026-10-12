import type { MetadataRoute } from "next";
import { getSiteUrl, REGION_CODES } from "@/lib/regions";

/**
 * Dynamic robots.txt file generator for Next.js.
 *
 * Crawling and indexing are enabled for all public pages. Private areas
 * (admin, dashboard, API) remain disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/api"],
      },
    ],
    sitemap: [`${siteUrl}/sitemap.xml`, `${siteUrl}/product-sitemap.xml`, ...REGION_CODES.map(country => `${siteUrl}/market-sitemaps/${country.toLowerCase()}`)],
    host: siteUrl,
  };
}
