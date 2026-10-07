import type { MetadataRoute } from "next";
import { REGION_CODES, getSiteUrl } from "@/lib/regions";
import { getPublicAdvertisers, slugifyAdvertiserName } from "@/lib/db/advertisers";
import { getCategoriesForCountry } from "@/lib/db/categories";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [];
  for (const country of REGION_CODES) {
    const base = `${site}/${country.toLowerCase()}`;
    entries.push({ url: base, changeFrequency: "daily", priority: 0.9 });
    const first = await getPublicAdvertisers({ country, requireDeals: true, pageSize: 100 });
    if (!first.total) continue;
    entries.push({ url: `${base}/stores`, changeFrequency: "weekly", priority: 0.7 },
      { url: `${base}/deals`, changeFrequency: "daily", priority: 0.8 },
      { url: `${base}/categories`, changeFrequency: "weekly", priority: 0.7 },
      { url: `${base}/methodology`, changeFrequency: "monthly", priority: 0.6 });
    for (let page = 1; page <= first.totalPages; page++) {
      const result = page === 1 ? first : await getPublicAdvertisers({ country, requireDeals: true, pageSize: 100, page });
      for (const store of result.advertisers) {
        entries.push({ url: `${base}/${slugifyAdvertiserName(store.name)}`, changeFrequency: "weekly", priority: 0.8 });
      }
    }
    const categories = await getCategoriesForCountry(country);
    for (const cat of categories) if ((cat.storeCount ?? 0) > 0) entries.push({ url: `${base}/category/${cat.slug}`, changeFrequency: "weekly", priority: 0.6 });
  }
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()];
}
