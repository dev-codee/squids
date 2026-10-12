import { getDb } from "@/lib/mongodb";
import { getSiteUrl, REGION_CODES } from "@/lib/regions";
import { sitemapXml, PRODUCT_SITEMAP_SHARD_SIZE } from "@/lib/model/sitemapXml";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const shards = await db.collection("products").aggregate<{ _id: number }>([
    { $match: { id: { $type: "number", $gt: 0, $lte: Number.MAX_SAFE_INTEGER }, regionCodes: { $in: REGION_CODES } } },
    { $group: { _id: { $floor: { $divide: ["$id", PRODUCT_SITEMAP_SHARD_SIZE] } } } },
    { $sort: { _id: 1 } },
  ], { maxTimeMS: 10_000 }).toArray();
  return new Response(sitemapXml(shards.map(shard => `${getSiteUrl()}/product-sitemaps/${shard._id}`), true), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
