import type { MetadataRoute } from "next";
import { getDb } from "@/lib/mongodb";
import { REGION_CODES, getSiteUrl } from "@/lib/regions";
import { cleanAdvertiserName } from "@/lib/networks";

export const revalidate = 86400; // Revalidate sitemap daily

/**
 * Dynamic XML sitemap generator for Next.js.
 *
 * Generates SEO-optimized URLs for public homepages, regional portals,
 * and active store pages. Excludes all admin, dashboard, and API paths.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [];

  const now = new Date();

  // 1. Root Homepage
  entries.push({
    url: siteUrl,
    lastModified: now,
    changeFrequency: "daily",
    priority: 1.0,
  });

  // 2. Regional Homepages
  REGION_CODES.forEach((code: string) => {
    entries.push({
      url: `${siteUrl}/${code.toLowerCase()}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    });
  });

  // 3. Regional utility pages (stores, deals, categories)
  REGION_CODES.forEach((code: string) => {
    const c = code.toLowerCase();
    entries.push(
      { url: `${siteUrl}/${c}/stores`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
      { url: `${siteUrl}/${c}/deals`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
      { url: `${siteUrl}/${c}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    );
  });

  // 4. Category detail pages (region × category slug)
  try {
    const db = await getDb();
    const categories = await db
      .collection("categories")
      .find({})
      .project({ _id: 0, slug: 1 })
      .toArray();

    REGION_CODES.forEach((code: string) => {
      categories.forEach((cat) => {
        if (cat.slug) {
          entries.push({
            url: `${siteUrl}/${code.toLowerCase()}/category/${cat.slug}`,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 0.6,
          });
        }
      });
    });
  } catch (err) {
    console.error("[sitemap] Failed to load categories for sitemap:", err);
  }

  // 5. Active Stores across DB
  try {
    const db = await getDb();
    const stores = await db
      .collection("advertisers")
      .find({ status: "active" })
      .project({ _id: 0, id: 1, name: 1, countryCode: 1, region: 1, syncedAt: 1 })
      .limit(5000)
      .toArray();

    const wwCodes = new Set(["ww", "global", "int", "00"]);

    stores.forEach((store) => {
      const cleanName = cleanAdvertiserName(store.name || "");
      const slug = cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || String(store.id);

      const rawCountry = (store.countryCode || store.region || "us").toLowerCase();
      // WW/GLOBAL stores serve all markets — default their sitemap entry to /us
      const country = wwCodes.has(rawCountry) ? "us" : rawCountry;
      const validCountry = REGION_CODES.some((c: string) => c.toLowerCase() === country)
        ? country
        : "us";

      entries.push({
        url: `${siteUrl}/${validCountry}/${slug}`,
        lastModified: store.syncedAt ? new Date(store.syncedAt) : now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    });
  } catch (err) {
    console.error("[sitemap] Failed to load stores for sitemap:", err);
  }

  return entries;
}
