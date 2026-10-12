import type { MetadataRoute } from "next";
import { REGION_CODES, getSiteUrl } from "@/lib/regions";

/** Static navigation pages; inventory lives in the market/product sitemaps. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  return REGION_CODES.flatMap(country => {
    const base = `${site}/${country.toLowerCase()}`;
    return [
      { url: base, changeFrequency: "daily" as const, priority: 0.9 },
      ...["products", "stores", "deals", "categories", "about", "privacy", "methodology"].map(path => ({
        url: `${base}/${path}`, changeFrequency: "weekly" as const, priority: 0.6,
      })),
    ];
  });
}
