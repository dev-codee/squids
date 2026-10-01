import { getDb } from "@/lib/mongodb";
import type { Product, PagedProducts } from "@/lib/products";

const COLLECTION = "products";

/** Sort orders the category listing exposes. Each is labelled on the page. */
export type ProductSort = "relevance" | "price-asc" | "price-desc";

export interface ProductQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  advertiserId?: number;
  /**
   * Category name to match. Products are tagged with a free-text category, so
   * this matches the full name, its first word (e.g. "Beauty" from
   * "Beauty & Health") and the slug form, case-insensitively.
   */
  category?: string;
  /** Restrict to products the feed reports as in stock. */
  inStockOnly?: boolean;
  /** Inclusive bounds on the item (sale) price. */
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
}

/** Escape a user/DB-supplied string for safe use inside a RegExp. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getProductsFromDb(query: ProductQuery): Promise<PagedProducts> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  const filter: Record<string, unknown> = {};

  if (query.search?.trim()) {
    filter.title = { $regex: query.search.trim(), $options: "i" };
  }
  if (query.advertiserId) {
    filter.advertiserId = query.advertiserId;
  }
  if (query.category?.trim()) {
    const name = query.category.trim();
    const head = name.split(/[&/,]/)[0].trim();
    const terms = Array.from(new Set([name, head, name.replace(/[^a-z0-9]+/gi, "-")]))
      .filter(Boolean)
      .map(escapeRegex);
    filter.category = { $regex: terms.join("|"), $options: "i" };
  }
  if (query.inStockOnly) {
    filter.inStock = true;
  }
  const priceBounds: Record<string, number> = {};
  if (typeof query.minPrice === "number" && Number.isFinite(query.minPrice)) {
    priceBounds.$gte = query.minPrice;
  }
  if (typeof query.maxPrice === "number" && Number.isFinite(query.maxPrice)) {
    priceBounds.$lte = query.maxPrice;
  }
  if (Object.keys(priceBounds).length > 0) {
    filter.salePrice = priceBounds;
  }

  const sortSpec: Record<string, 1 | -1> =
    query.sort === "price-asc"
      ? { salePrice: 1 }
      : query.sort === "price-desc"
        ? { salePrice: -1 }
        : { id: -1 };

  const pageSize = Math.max(1, Math.min(100, query.pageSize || 24));
  const total = await col.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(totalPages, query.page || 1));
  const skip = (page - 1) * pageSize;

  const docs = await col
    .find(filter, { projection: { _id: 0 } })
    .sort(sortSpec)
    .skip(skip)
    .limit(pageSize)
    .toArray();

  return {
    products: docs as Product[],
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function getNextProductId(): Promise<number> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);
  const maxDoc = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  return maxDoc.length > 0 ? maxDoc[0].id + 1 : 10000;
}

export async function createProduct(product: Product): Promise<Product> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  await col.createIndex({ id: 1 }, { unique: true });
  await col.createIndex({ advertiserId: 1 });

  await col.updateOne({ id: product.id }, { $set: product }, { upsert: true });

  return product;
}

export async function updateProduct(id: number, data: Partial<Product>): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  const result = await col.updateOne({ id }, { $set: data });
  return result.matchedCount > 0;
}

export async function deleteProduct(id: number): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}

// ---------------------------------------------------------------------------
// Product comparison — grouping the same item across retailers
// ---------------------------------------------------------------------------

/**
 * Normalise a product title into a match key.
 *
 * The feed carries no GTIN, brand or model field, so the title is the only
 * signal we have for "this is the same product at another retailer". We lower
 * case, strip punctuation and collapse whitespace; anything more aggressive
 * starts merging genuinely different variants.
 */
export function productMatchKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Single product by its numeric id. */
export async function getProductById(id: number): Promise<Product | null> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);
  const doc = await col.findOne({ id }, { projection: { _id: 0 } });
  return (doc as Product) ?? null;
}

/**
 * Every product record matching the same normalised title, one per retailer.
 *
 * Matching is done in the application rather than the query because the match
 * key is derived, not stored. The candidate set is narrowed by category first
 * so this stays a bounded scan.
 */
export async function getMatchingProducts(product: Product): Promise<Product[]> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  const key = productMatchKey(product.title);
  const filter: Record<string, unknown> = {};
  if (product.category) filter.category = product.category;

  const candidates = (await col
    .find(filter, { projection: { _id: 0 } })
    .limit(2000)
    .toArray()) as Product[];

  const matches = candidates.filter((c) => productMatchKey(c.title) === key);

  // One record per retailer — keep the cheapest when a retailer lists it twice.
  const byRetailer = new Map<number, Product>();
  for (const match of matches) {
    const existing = byRetailer.get(match.advertiserId);
    const price = match.salePrice ?? Number.POSITIVE_INFINITY;
    const existingPrice = existing?.salePrice ?? Number.POSITIVE_INFINITY;
    if (!existing || price < existingPrice) byRetailer.set(match.advertiserId, match);
  }

  // The record this comparison is for always stays in the set, even when the
  // same retailer lists a cheaper duplicate — it is the one row whose identity
  // is certain, and the page labels it as such.
  byRetailer.set(product.advertiserId, product);

  return Array.from(byRetailer.values());
}

/** Other products in the same category, for the "related products" row. */
export async function getRelatedProducts(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  const key = productMatchKey(product.title);
  const filter: Record<string, unknown> = { id: { $ne: product.id } };
  if (product.category) filter.category = product.category;

  const docs = (await col
    .find(filter, { projection: { _id: 0 } })
    .limit(limit * 6)
    .toArray()) as Product[];

  const seen = new Set<string>([key]);
  const out: Product[] = [];
  for (const doc of docs) {
    const docKey = productMatchKey(doc.title);
    if (seen.has(docKey)) continue;
    seen.add(docKey);
    out.push(doc);
    if (out.length >= limit) break;
  }
  return out;
}
