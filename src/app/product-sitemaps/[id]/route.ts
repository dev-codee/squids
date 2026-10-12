import { TEST_PRODUCT_TITLE } from "@/lib/model/productSeo";
import { getDb } from "@/lib/mongodb";
import { getSiteUrl, isValidRegionCode } from "@/lib/regions";
import { sitemapXml, PRODUCT_SITEMAP_SHARD_SIZE } from "@/lib/model/sitemapXml";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const shard = Number(params.id);
  if (!/^\d+$/.test(params.id) || !Number.isSafeInteger(shard) || !Number.isSafeInteger((shard + 1) * PRODUCT_SITEMAP_SHARD_SIZE)) {
    return new Response("Not found", { status: 404 });
  }
  const db = await getDb();
  const products = await db.collection<{ id: number; title: string; regionCodes?: string[] }>("products")
    .find({ title: { $type: "string", $regex: /\S/, $not: TEST_PRODUCT_TITLE }, id: { $gte: shard * PRODUCT_SITEMAP_SHARD_SIZE, $lt: (shard + 1) * PRODUCT_SITEMAP_SHARD_SIZE } }, { projection: { _id: 0, id: 1, regionCodes: 1 } })
    .sort({ id: 1 }).maxTimeMS(10_000).toArray();
  const urls = new Set<string>();
  for (const product of products) {
    if (!Number.isSafeInteger(product.id) || product.id <= 0) continue;
    for (const country of product.regionCodes ?? []) {
      // Match the detail page's exact region availability check.
      if (isValidRegionCode(country) && country === country.toUpperCase()) urls.add(`${getSiteUrl()}/${country.toLowerCase()}/product/${product.id}`);
    }
  }
  if (!urls.size) return new Response("Not found", { status: 404 });
  return new Response(sitemapXml([...urls]), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
