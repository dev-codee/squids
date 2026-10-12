import { getPublicStoreRecords, slugifyAdvertiserName } from "@/lib/db/advertisers";
import { getCategoriesForCountry } from "@/lib/db/categories";
import { getSiteUrl, isValidRegionCode } from "@/lib/regions";
import { sitemapXml } from "@/lib/model/sitemapXml";

export const dynamic = "force-dynamic";

/** One market per request keeps the main sitemap independent of 36 database scans. */
export async function GET(_request: Request, { params }: { params: { country: string } }) {
  if (!isValidRegionCode(params.country) || params.country !== params.country.toLowerCase()) return new Response("Not found", { status: 404 });
  const base = `${getSiteUrl()}/${params.country}`;
  const [stores, categories] = await Promise.all([
    getPublicStoreRecords(params.country.toUpperCase()),
    getCategoriesForCountry(params.country.toUpperCase()),
  ]);
  const urls = new Set<string>();
  for (const store of stores) if ((store.dealCount ?? 0) > 0) urls.add(`${base}/${slugifyAdvertiserName(store.name)}`);
  for (const category of categories) if ((category.storeCount ?? 0) > 0) urls.add(`${base}/category/${category.slug}`);
  return new Response(sitemapXml([...urls]), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
