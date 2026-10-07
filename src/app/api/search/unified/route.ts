import { getPublicAdvertisers, slugifyAdvertiserName } from "@/lib/db/advertisers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { storeSlug } from "@/lib/networks";
import type { Product } from "@/lib/products";

export const dynamic = "force-dynamic";

export interface UnifiedSearchProductItem {
  id: number;
  title: string;
  brand?: string | null;
  size?: string | null;
  imageUrl?: string | null;
  salePrice?: number | null;
  category?: string | null;
}

export interface UnifiedSearchStoreItem {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string | null;
  dealCount?: number;
}

export interface UnifiedSearchCategoryItem {
  name: string;
  slug: string;
}

export interface UnifiedSearchResult {
  query: string;
  stores: UnifiedSearchStoreItem[];
  products: UnifiedSearchProductItem[];
  categories: UnifiedSearchCategoryItem[];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim();
    const country = (searchParams.get("country") || "US").toUpperCase();
    const limit = Math.min(10, Math.max(1, parseInt(searchParams.get("limit") || "5", 10) || 5));

    if (query.length < 2) {
      return NextResponse.json({
        query,
        stores: [],
        products: [],
        categories: [],
      } satisfies UnifiedSearchResult);
    }

    const db = await getDb();
    const regex = new RegExp(escapeRegex(query), "i");

    const [storesDocs, productsDocs, categoriesDocs] = await Promise.all([
      getPublicAdvertisers({ country, search: query, requireDeals: true, pageSize: limit }).then((r) => r.advertisers),

      // 2. Products
      db
        .collection<Product>("products")
        .find({
          regionCodes: country,
          $or: [
            { title: { $regex: regex } },
            { brand: { $regex: regex } },
            { mpn: { $regex: regex } },
          ],
        })
        .project({
          _id: 0,
          id: 1,
          title: 1,
          brand: 1,
          size: 1,
          imageUrl: 1,
          salePrice: 1,
          category: 1,
        })
        .limit(limit)
        .toArray(),

      // 3. Categories
      db
        .collection("categories")
        .find({
          name: { $regex: regex },
        })
        .project({ _id: 0, name: 1, slug: 1 })
        .limit(limit)
        .toArray(),
    ]);

    const stores: UnifiedSearchStoreItem[] = storesDocs.map((s: any) => ({
      id: s.id,
      name: s.name,
      slug: slugifyAdvertiserName(s.name),
      logoUrl: s.logoUrl || null,
      dealCount: typeof s.dealCount === "number" ? s.dealCount : undefined,
    }));

    const products: UnifiedSearchProductItem[] = productsDocs.map((p: any) => ({
      id: p.id,
      title: p.title,
      brand: p.brand || null,
      size: p.size || null,
      imageUrl: p.imageUrl || null,
      salePrice: typeof p.salePrice === "number" ? p.salePrice : null,
      category: p.category || null,
    }));

    const categories: UnifiedSearchCategoryItem[] = categoriesDocs.map((c: any) => ({
      name: c.name,
      slug: c.slug,
    }));

    return NextResponse.json({
      query,
      stores,
      products,
      categories,
    } satisfies UnifiedSearchResult);
  } catch (error) {
    console.error("[api/search/unified] Search failure:", error);
    return NextResponse.json(
      { query: "", stores: [], products: [], categories: [] },
      { status: 500 },
    );
  }
}
