import type { MetadataRoute } from "next";

/**
 * Dynamic robots.txt file generator for Next.js.
 *
 * Indexing and crawling are currently disabled site-wide for all bots/crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
  };
}
