import { getDb } from "@/lib/mongodb";
import type { Product, PagedProducts } from "@/lib/products";
import type { MatchCandidate, MatchResult } from "@/lib/model/matching";
import {
  classifyMatch,
  orderedMatches,
  productMatchKey,
  canClaimComparison,
} from "@/lib/model/matching";
import { getRulingsForProduct, queueMatchReview } from "@/lib/db/match-reviews";

const COLLECTION = "products";

/** Sort orders the category listing exposes. Each is labelled on the page. */
export type ProductSort = "relevance" | "price-asc" | "price-desc";

export interface ProductQuery {
  country?: string;
  network?: string;
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
  brand?: string;
  size?: string;
  condition?: string;
}

export interface ProductFacets {
  brands: { name: string; count: number }[];
  sizes: { name: string; count: number }[];
  conditions: { name: string; count: number }[];
}

/** Escape a user/DB-supplied string for safe use inside a RegExp. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getProductsFromDb(query: ProductQuery): Promise<PagedProducts> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  const filter: Record<string, unknown> = {};
  if (query.country) filter.regionCodes = query.country.toUpperCase();
  if (query.network) filter.network = query.network;

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
  if (query.brand?.trim()) {
    filter.brand = { $regex: `^${escapeRegex(query.brand.trim())}$`, $options: "i" };
  }
  if (query.size?.trim()) {
    filter.size = { $regex: `^${escapeRegex(query.size.trim())}$`, $options: "i" };
  }
  if (query.condition?.trim()) {
    filter.condition = query.condition.trim();
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

export async function getProductFacets(category?: string): Promise<ProductFacets> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  const match: Record<string, unknown> = {};
  if (category?.trim()) {
    const name = category.trim();
    const head = name.split(/[&/,]/)[0].trim();
    const terms = Array.from(new Set([name, head, name.replace(/[^a-z0-9]+/gi, "-")]))
      .filter(Boolean)
      .map(escapeRegex);
    match.category = { $regex: terms.join("|"), $options: "i" };
  }

  const [brandDocs, sizeDocs, conditionDocs] = await Promise.all([
    col.aggregate<{ _id: string; count: number }>([
      { $match: { ...match, brand: { $nin: [null, ""] } } },
      { $group: { _id: "$brand", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]).toArray(),
    col.aggregate<{ _id: string; count: number }>([
      { $match: { ...match, size: { $nin: [null, ""] } } },
      { $group: { _id: "$size", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]).toArray(),
    col.aggregate<{ _id: string; count: number }>([
      { $match: { ...match, condition: { $nin: [null, ""] } } },
      { $group: { _id: "$condition", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
  ]);

  return {
    brands: brandDocs.map((d) => ({ name: d._id, count: d.count })),
    sizes: sizeDocs.map((d) => ({ name: d._id, count: d.count })),
    conditions: conditionDocs.map((d) => ({ name: d._id, count: d.count })),
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
 * Re-exported from the matching model, where the rule it belongs to lives: a
 * normalised title proposes a candidate, it never confirms one.
 */
export { productMatchKey };

/** Single product by its numeric id. */
export async function getProductById(id: number): Promise<Product | null> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);
  const doc = await col.findOne({ id }, { projection: { _id: 0 } });
  return (doc as Product) ?? null;
}

/** One comparison row: the product record plus how it was matched. */
export interface MatchedProduct {
  product: Product;
  result: MatchResult;
}

export interface ProductMatches {
  rows: MatchedProduct[];
  /** True only with two independent retailers matched on identifiers. */
  canClaimComparison: boolean;
  /** Candidates shown but not proven — the count the page must be honest about. */
  reviewCount: number;
}

function toCandidate(product: Product): MatchCandidate {
  return { ...product, id: product.id, advertiserId: product.advertiserId, title: product.title };
}

/**
 * Every product record that may be the same item, one row per retailer.
 *
 * Identifier-first: candidates are proposed by category and title (that is all
 * a query can do cheaply), then `classifyMatch` decides each one on
 * identifiers, with a reviewer's standing ruling outranking everything. Rows it
 * calls "not-a-match" are dropped; rows it sends to review are kept but carry
 * that basis, so the page can display them without claiming them.
 *
 * Pairs needing a decision are queued for the review desk as a side effect.
 * That write is best-effort — a comparison page must still render if the queue
 * is unavailable.
 */
export async function getMatchingProducts(product: Product): Promise<ProductMatches> {
  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  const key = productMatchKey(product.title);
  const source = toCandidate(product);

  // Candidate net: anything sharing a strong identifier, plus the title group
  // within the category. The identifier arm is what makes this identifier-first
  // rather than a title search wearing a new label.
  const identifierClauses: Record<string, unknown>[] = [];
  if (product.gtin) identifierClauses.push({ gtin: product.gtin });
  if (product.mpn && product.brand) {
    identifierClauses.push({ mpn: product.mpn, brand: product.brand });
  }

  const titleClause: Record<string, unknown> = product.category
    ? { category: product.category }
    : {};

  const candidates = (await col
    .find(
      identifierClauses.length
        ? { $or: [...identifierClauses, titleClause] }
        : titleClause,
      { projection: { _id: 0 } },
    )
    .limit(2000)
    .toArray()) as Product[];

  const rulings = await getRulingsForProduct(product.id).catch(
    () => new Map<string, never>() as never,
  );

  const considered = candidates.filter(
    (c) =>
      c.id !== product.id &&
      (productMatchKey(c.title) === key ||
        (Boolean(product.gtin) && c.gtin === product.gtin) ||
        (Boolean(product.mpn) && c.mpn === product.mpn && c.brand === product.brand)),
  );

  const classified = considered.map((candidate) => ({
    candidate,
    result: classifyMatch(source, toCandidate(candidate), rulings),
  }));

  // One row per retailer. An exact match always beats a review candidate from
  // the same retailer; among equals, the cheaper price wins.
  const byRetailer = new Map<number, { candidate: Product; result: MatchResult }>();
  for (const entry of classified) {
    if (entry.result.decision === "not-a-match") continue;
    if (entry.candidate.advertiserId === product.advertiserId) continue;
    const existing = byRetailer.get(entry.candidate.advertiserId);
    if (!existing) {
      byRetailer.set(entry.candidate.advertiserId, entry);
      continue;
    }
    const betterBasis =
      entry.result.decision === "exact" && existing.result.decision !== "exact";
    const cheaper =
      entry.result.decision === existing.result.decision &&
      (entry.candidate.salePrice ?? Number.POSITIVE_INFINITY) <
        (existing.candidate.salePrice ?? Number.POSITIVE_INFINITY);
    if (betterBasis || cheaper) byRetailer.set(entry.candidate.advertiserId, entry);
  }

  // The record this comparison is for is always row one: it is the only row
  // whose identity is certain, because it is the page's own listing.
  const sourceRow: MatchedProduct = {
    product,
    result: {
      candidateId: product.id,
      decision: "exact",
      basis: "identifier",
      matchedOn: [],
      conflicts: [],
      reviewBasis: null,
      reason: "This page's own listing",
    },
  };

  const others = orderedMatches(Array.from(byRetailer.values()).map((e) => e.result));
  const byId = new Map(
    Array.from(byRetailer.values()).map((e) => [e.candidate.id, e.candidate]),
  );
  const rows: MatchedProduct[] = [
    sourceRow,
    ...others
      .map((result) => {
        const match = byId.get(result.candidateId);
        return match ? { product: match, result } : null;
      })
      .filter((r): r is MatchedProduct => r !== null),
  ];

  // Queue what a person still has to decide. Never blocks the page.
  void Promise.all(
    rows
      .filter((row) => row.result.decision === "review")
      .map((row) =>
        queueMatchReview({
          source: { id: product.id, title: product.title, advertiserId: product.advertiserId },
          candidate: {
            id: row.product.id,
            title: row.product.title,
            advertiserId: row.product.advertiserId,
          },
          result: row.result,
        }).catch(() => undefined),
      ),
  );

  return {
    rows,
    // The source listing counts as one of the two retailers: its identity is
    // certain, so a second exact row is what completes the claim.
    canClaimComparison: canClaimComparison(
      rows.map((row) => ({ result: row.result, advertiserId: row.product.advertiserId })),
    ),
    reviewCount: rows.filter((row) => row.result.decision === "review").length,
  };
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

/**
 * Other variants of the same product — the size/colour/pack switcher.
 *
 * Variants are found on identity, never on title: records sharing a brand and
 * model (or a brand alone, where no model is recorded) but differing on a
 * variant field. A product with no identity fields has no variants to offer,
 * which is the honest answer — guessing them from title fragments is how a
 * 30 ml and a 60 ml end up compared as one item.
 */
export async function getProductVariants(
  product: Product,
  limit = 12,
): Promise<Product[]> {
  if (!product.brand) return [];

  const db = await getDb();
  const col = db.collection<Product>(COLLECTION);

  const filter: Record<string, unknown> = { brand: product.brand, id: { $ne: product.id } };
  if (product.mpn) filter.mpn = product.mpn;

  const docs = (await col
    .find(filter, { projection: { _id: 0 } })
    .limit(limit * 4)
    .toArray()) as Product[];

  const differs = (a: Product, b: Product) =>
    (a.size ?? null) !== (b.size ?? null) ||
    (a.colour ?? null) !== (b.colour ?? null) ||
    (a.flavour ?? null) !== (b.flavour ?? null) ||
    (a.packCount ?? null) !== (b.packCount ?? null);

  // One entry per distinct variant, so a variant stocked by five retailers
  // offers one switch target rather than five.
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const doc of docs) {
    if (!differs(doc, product)) continue;
    const key = [doc.size, doc.colour, doc.flavour, doc.packCount].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(doc);
    if (out.length >= limit) break;
  }
  return out;
}

/** A short human label for a variant switch, e.g. "30 ml · Blue · 3-pack". */
export function variantLabel(product: Product): string {
  const parts = [
    product.size,
    product.colour,
    product.flavour,
    typeof product.packCount === "number" && product.packCount > 1
      ? `${product.packCount}-pack`
      : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : product.title;
}
