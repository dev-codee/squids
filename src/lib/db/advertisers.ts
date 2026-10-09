/**
 * MongoDB persistence layer for Advertisers.
 *
 * Stores the normalised `Advertiser` type from `@/lib/awin` with a
 * `syncedAt` timestamp. Provides bulk upsert (for cron sync) and
 * query/filter/paginate (for the API route).
 *
 * Multi-network: keyed on composite `(network, id)` to avoid ID collisions
 * between Awin and Admitad (or future networks).
 */

import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/mongodb";
import { publicMerchantFilter, publicOfferCountStages, publicMerchantCountKey, merchantNameExpression } from "@/lib/model/publication";
import { singleFlight } from "@/lib/model/singleFlight";
import { NOT_EXPIRED } from "@/lib/expiry";
import { normalizeCountryCode, foreignCountrySignals } from "@/lib/countries";
import { cleanAdvertiserName, storeSlug } from "@/lib/networks";
import { resolveAffiliateTrackingUrl } from "@/lib/affiliateUrls";
import { CACHE_TAGS, PUBLIC_REVALIDATE } from "@/lib/cache";
import type {
  Advertiser,
  AdvertiserQuery,
  AdvertiserFacets,
  PagedAdvertisers,
} from "@/lib/awin";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/awin";

const COLLECTION = "advertisers";
/** Deals collection — read here to rank same-slug advertisers by real deal count. */
const COLLECTION_DEALS = "deals";

interface AdvertiserDoc extends Advertiser {
  syncedAt: Date;
}

export function normalizeAdvertiserDoc(doc: any): Advertiser {
  if (!doc) return doc;
  if (doc.name) {
    doc.name = cleanAdvertiserName(doc.name);
  }
  doc.url = resolveAffiliateTrackingUrl(doc.network, doc.id, doc.url);
  doc.categories = doc.reviewedCategories ?? (doc.categoriesReviewedAt ? doc.categories ?? [] : []);
  return doc as Advertiser;
}

// ---------------------------------------------------------------------------
// Write — used by the cron sync job
// ---------------------------------------------------------------------------

/**
 * Upsert a batch of advertisers into MongoDB.
 * Uses bulk `updateOne` with `upsert: true` keyed on `(network, id)`.
 */
export async function upsertAdvertisers(
  advertisers: Advertiser[],
): Promise<{ upserted: number; modified: number }> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  // Ensure composite unique index for multi-network support
  await col.createIndex({ network: 1, id: 1 }, { unique: true });

  const now = new Date();
  const ops = advertisers.map((a) => ({
    updateOne: {
      filter: { network: a.network ?? "awin", id: a.id },
      update: { $setOnInsert: { ...a, network: a.network ?? "awin", syncedAt: now } },
      upsert: true,
    },
  }));

  if (ops.length === 0) return { upserted: 0, modified: 0 };

  const result = await col.bulkWrite(ops, { ordered: false });
  return {
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
  };
}

// ---------------------------------------------------------------------------
// Read — used by the API route
// ---------------------------------------------------------------------------

/**
 * Build MongoDB filter from the query parameters.
 */
export function buildAdvertiserFilter(query: AdvertiserQuery & { network?: string }): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  // Accumulate independent clauses here so that multiple filters (e.g. country
  // AND category) all apply — a single `filter.$or` would let a later clause
  // silently overwrite an earlier one.
  const and: Record<string, unknown>[] = [];

  if (query.network) {
    filter.network = query.network;
  }

  if (query.search?.trim()) {
    filter.name = { $regex: escapeRegExp(query.search.trim()), $options: "i" };
  }
  if (query.region) {
    filter.region = query.region;
  }
  if (query.relationship) {
    filter.relationship = query.relationship;
  }
  if (query.country?.trim()) {
    const raw = query.country.trim().toUpperCase();
    const normCc = normalizeCountryCode(raw);
    const regexMatch = new RegExp(`(?:^|[-_])${normCc}$`, "i");
    // Match the requested country explicitly, or fall back to worldwide/global.
    and.push({
      $or: [
        { countryCode: raw },
        { countryCode: normCc },
        { countryCode: { $regex: regexMatch } },
        { countryCodes: raw },
        { countryCodes: normCc },
        { countryCodes: { $regex: regexMatch } },
        { countryCode: { $in: ["WW", "GLOBAL", "INT", "00"] } },
        { countryCodes: { $in: ["WW", "GLOBAL", "INT", "00"] } },
        { region: { $in: ["00", "WW", "GLOBAL", "INT"] } },
        { region: { $regex: /^(global|worldwide)$/i } },
      ],
    });

    // Exclude stores whose name/URL explicitly signals a *different* country
    // (e.g. "acer.fr"/"Aosom.fr" must not show under "DE"), even if the store
    // is tagged worldwide/global by the network feed.
    const foreign = foreignCountrySignals(normCc);
    if (foreign.length > 0) {
      const foreignRegex = foreign.join("|");
      and.push({
        $nor: [
          { name: { $regex: foreignRegex, $options: "i" } },
          { url: { $regex: foreignRegex, $options: "i" } },
        ],
      });
    }
  }

  if (query.category?.trim()) {
    const cat = query.category.trim();
    const catRegex = new RegExp(`^${cat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    and.push({
      $or: [
        { reviewedCategories: { $elemMatch: { $regex: catRegex } } },
        { categoriesReviewedAt: { $exists: true, $ne: null }, categories: cat },
      ],
    });
  }

  if (and.length > 0) {
    filter.$and = and;
  }

  return filter;
}

/**
 * Count advertisers matching a category within a given country/region, using the
 * exact same country + category filter as the public listing. This keeps the
 * per-region "N stores" badge on category boxes in sync with the number of
 * stores the category page actually renders for that country.
 */
export async function countAdvertisersByCategory(
  country: string,
  categoryName: string,
): Promise<number> {
  const result = await getPublicAdvertisers({ country, category: categoryName, requireDeals: true, pageSize: 1 });
  return result.total;
}

/**
 * Count all advertisers matching a category globally (no country filter).
 * Used as a fallback when the per-country count is zero to avoid showing
 * empty category cards on homepages where country-specific coverage is limited.
 */
export async function countAdvertisersGloballyByCategory(
  categoryName: string,
): Promise<number> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);
  const filter = buildAdvertiserFilter({ category: categoryName } as AdvertiserQuery);
  return col.countDocuments(filter);
}

/**
 * Fetch facets (distinct regions, relationships, countries, categories) from the full dataset.
 */
export async function getAdvertiserFacets(): Promise<AdvertiserFacets> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  const [regions, relationships, countries, rawCategories] = await Promise.all([
    col.distinct("region", { region: { $ne: null } }),
    col.distinct("relationship", { relationship: { $ne: null } }),
    col.distinct("countryCode", { countryCode: { $ne: null } }),
    col.distinct("categories", { categories: { $exists: true } }),
  ]);


  const countrySet = new Set<string>();
  for (const c of countries as string[]) {
    const norm = normalizeCountryCode(c);
    if (norm) countrySet.add(norm);
  }

  const categorySet = new Set<string>();
  for (const cat of rawCategories as (string | string[])[]) {
    if (Array.isArray(cat)) {
      cat.forEach((item) => item && categorySet.add(item.trim()));
    } else if (typeof cat === "string" && cat.trim()) {
      categorySet.add(cat.trim());
    }
  }

  return {
    regions: (regions as string[]).sort(),
    relationships: (relationships as string[]).sort(),
    countries: Array.from(countrySet).sort(),
    categories: Array.from(categorySet).sort(),
  };
}



/**
 * Query advertisers from MongoDB with filtering and pagination.
 * Returns the same `PagedAdvertisers` shape the API route expects.
 */
async function getAdvertisersFromDbUncached(
  query: AdvertiserQuery & { network?: string; withFacets?: boolean },
): Promise<PagedAdvertisers | null> {
  // Public search/pagination must use the same canonical, batched directory
  // as server-rendered pages, rather than rejoining every advertiser to deals.
  if (query.requireDeals && !query.withFacets) return getPublicAdvertisers(query);
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  // If the collection is empty, return null so the caller falls back to Awin
  const count = await col.estimatedDocumentCount();
  if (count === 0) return null;

  const filter = buildAdvertiserFilter(query);
  // Facets require 4 full-collection distinct() scans; only the admin dashboard
  // consumes them. Skip on public listings (homepage/stores) to keep the query
  // well under the serverless response deadline.
  const facets = query.withFacets
    ? await getAdvertiserFacets()
    : { regions: [], relationships: [], countries: [], categories: [] };

  const pageSize = Math.min(
    Math.max(1, query.pageSize || DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  let total: number;
  if (query.requireDeals) {
    const countRes = await col.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "deals",
          let: { advId: "$id", advNetwork: "$network", advIdStr: { $toString: "$id" } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $or: [
                        { $eq: ["$advertiser.id", "$$advId"] },
                        { $eq: ["$advertiser.id", "$$advIdStr"] },
                      ],
                    },
                    { $eq: ["$network", "$$advNetwork"] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "activeDeals",
        },
      },
      { $match: { "activeDeals.0": { $exists: true } } },
      { $count: "total" }
    ]).toArray();
    total = countRes.length > 0 ? countRes[0].total : 0;
  } else {
    total = await col.countDocuments(filter);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page || 1), totalPages);
  const skip = (page - 1) * pageSize;

  let docs: any[];
  if (query.requireDeals) {
    docs = await col.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "deals",
          let: { advId: "$id", advNetwork: "$network", advIdStr: { $toString: "$id" } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $or: [
                        { $eq: ["$advertiser.id", "$$advId"] },
                        { $eq: ["$advertiser.id", "$$advIdStr"] },
                      ],
                    },
                    { $eq: ["$network", "$$advNetwork"] },
                  ],
                },
              },
            },
            // An expired offer must not keep a store listed or inflate its count.
            { $match: NOT_EXPIRED },
          ],
          as: "activeDeals",
        },
      },
      { $match: { "activeDeals.0": { $exists: true } } },
      { $sort: { isFlagship: -1, name: 1 } },
      { $skip: skip },
      { $limit: pageSize },
      {
        $addFields: {
          dealCount: { $size: "$activeDeals" }
        }
      },
      { $project: { _id: 0, syncedAt: 0, activeDeals: 0 } },
    ]).toArray();
  } else {
    docs = await col
      .find(filter, { projection: { _id: 0, syncedAt: 0 } })
      .sort({ isFlagship: -1, name: 1 })
      .skip(skip)
      .limit(pageSize)
      .toArray();

    // Fetch deal counts manually for the non-joined query
    const dealsCol = db.collection("deals");
    for (const doc of docs) {
      const numId = Number(doc.id);
      const strId = String(doc.id);
      const idMatch = !isNaN(numId) ? { $in: [numId, strId] } : strId;

      const dealFilter: Record<string, unknown> = {
        "advertiser.id": idMatch,
        ...NOT_EXPIRED,
      };
      if (doc.network) {
        dealFilter.network = doc.network;
      }

      doc.dealCount = await dealsCol.countDocuments(dealFilter);
    }
  }

  const normalizedDocs = docs.map((doc) => normalizeAdvertiserDoc(doc));

  return {
    advertisers: normalizedDocs,
    page,
    pageSize,
    total,
    totalPages,
    facets,
  };
}

/**
 * Lightweight "showcase" reader for the home page.
 *
 * The full `getAdvertisersFromDbUncached` with `requireDeals` runs a `$lookup`
 * into the deals collection for EVERY matching advertiser (thousands), twice
 * (count + page), *before* paginating — which is what makes the home fetch time
 * out. This path instead sorts + limits FIRST, then computes deal counts for
 * only the handful of returned advertisers, so cost is O(limit), not O(all).
 *
 * No total/pagination: the home page is a fixed showcase, and the full browsable
 * grid lives on the /stores page (which still uses the paginated reader).
 */
async function getShowcaseAdvertisersUncached(
  query: AdvertiserQuery & { network?: string },
): Promise<PagedAdvertisers | null> {
  if (query.requireDeals) return getPublicAdvertisers(query);
  return getPublicAdvertisers({ ...query, requireDeals: true });
}

/**
 * Get a single advertiser by ID from MongoDB.
 * Optionally scoped by network; defaults to any network.
 */
async function getAdvertiserByIdFromDbUncached(
  id: number,
  network?: string,
): Promise<Advertiser | null> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);
  const filter: Record<string, unknown> = { id };
  if (network) filter.network = network;
  const doc = await col.findOne(filter, { projection: { _id: 0, syncedAt: 0 } });
  if (!doc) return null;
  return normalizeAdvertiserDoc(doc);
}

/**
 * Fetch a single advertiser by id WITHOUT public normalization — the raw stored
 * `name` (with any region/WW suffix) and raw `url` are returned untouched.
 *
 * The admin edit UI must load this, not the public/normalized reader: cleaning
 * the name or rewriting the URL for display and then saving it back would
 * permanently destroy the original values. Not cached — admin routes are
 * force-dynamic and must always see the latest write.
 */
export async function getRawAdvertiserById(
  id: number,
  network?: string,
): Promise<Advertiser | null> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);
  const filter: Record<string, unknown> = { id };
  if (network) filter.network = network;
  const doc = await col.findOne(filter, { projection: { _id: 0, syncedAt: 0 } });
  return (doc as unknown as Advertiser) || null;
}

// ---------------------------------------------------------------------------
// AI-generated store page content (Claude)
// ---------------------------------------------------------------------------

/** Persist AI-generated store page content on an advertiser for a specific locale. */
export async function setAdvertiserStorePage(
  id: number,
  network: string,
  content: unknown,
  locale: string = "en",
): Promise<boolean> {
  const normLocale = locale.toLowerCase().split("-")[0];
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);
  const now = new Date();
  const nowIso = now.toISOString();

  const updateFields: Record<string, unknown> = {
    [`aiStorePageByLang.${normLocale}`]: content,
    [`aiStorePageAtByLang.${normLocale}`]: nowIso,
    syncedAt: now,
  };

  // Keep legacy flat fields updated as the 'en' alias
  if (normLocale === "en") {
    updateFields.aiStorePage = content;
    updateFields.aiStorePageAt = nowIso;
  }

  const result = await col.updateOne(
    { network, id },
    { $set: updateFields },
  );
  return result.matchedCount > 0;
}

/**
 * Ensure an advertiser has AI store-page content for a specific locale, generating it the first time
 * and caching it so tokens are only spent once per merchant per language. Best-effort: returns
 * the advertiser unchanged when AI is unconfigured or generation fails. Pass
 * `force` to regenerate.
 */
export async function ensureAdvertiserStorePage(
  advertiser: Advertiser,
  deals: import("@/lib/deals").Deal[],
  ctx: { country: string; currency: string; language?: string; locale?: string },
  opts?: { force?: boolean; locale?: string },
): Promise<Advertiser> {
  const locale = (opts?.locale || ctx.locale || "en").toLowerCase().split("-")[0];

  // Check cache for this locale
  const alreadyGenerated =
    !opts?.force &&
    (advertiser.aiStorePageByLang?.[locale] || (locale === "en" && advertiser.aiStorePage));

  if (alreadyGenerated) return advertiser;

  const { isAiConfigured, generateStorePageContent } = await import("@/lib/ai/storeContent");
  if (!isAiConfigured()) return advertiser;

  try {
    const content = await generateStorePageContent(advertiser, deals, {
      ...ctx,
      locale,
    });
    await setAdvertiserStorePage(advertiser.id, advertiser.network ?? "awin", content, locale);

    const nowIso = new Date().toISOString();
    const updatedByLang = {
      aiStorePageByLang: {
        ...(advertiser.aiStorePageByLang || {}),
        [locale]: content as any,
      },
      aiStorePageAtByLang: {
        ...(advertiser.aiStorePageAtByLang || {}),
        [locale]: nowIso,
      },
    };

    return {
      ...advertiser,
      ...updatedByLang,
      ...(locale === "en"
        ? {
            aiStorePage: content as any,
            aiStorePageAt: nowIso,
          }
        : {}),
    };
  } catch (err) {
    console.warn(
      `[ai] Failed to generate store page for ${advertiser.network}:${advertiser.id} (${locale}):`,
      err instanceof Error ? err.message : err,
    );
    return advertiser;
  }
}

/** Turn an advertiser name into a URL slug (lowercase, hyphenated). */
export function slugifyAdvertiserName(name: string): string {
  return storeSlug(name);
}

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Score how well an advertiser matches a requested country/region.
 *
 * The store URL is region-scoped (`/[country]/[store]`), so when the same brand
 * exists on multiple networks (e.g. an Awin "myBrainCo" for US and a Commission
 * Factory "myBrainCo" for AU), the one whose region matches the URL must win.
 *
 *  - 3 → serves the exact requested country
 *  - 1 → worldwide/global, or no region data (safe generic fallback)
 *  - 0 → serves a *different* country (should only be chosen as a last resort)
 */
function advertiserRegionScore(
  a: Advertiser,
  country?: string,
): number {
  const cc = normalizeCountryCode(country);
  if (!cc || cc === "WW") return 1; // no country context — treat all as neutral

  const codes = new Set<string>();
  if (Array.isArray(a.countryCodes)) {
    for (const c of a.countryCodes) codes.add(normalizeCountryCode(c));
  }
  if (a.countryCode) codes.add(normalizeCountryCode(a.countryCode));
  if (a.region) codes.add(normalizeCountryCode(a.region));

  if (codes.has(cc)) return 3;
  if (codes.size === 0 || codes.has("WW")) return 1;
  return 0;
}

/**
 * Resolve a store slug (e.g. "amazon", "best-buy") to an advertiser.
 *
 * Advertisers have no dedicated slug field, so we match the slug against the
 * slugified `name` using a loose, anchored, case-insensitive regex where each
 * hyphen tolerates any run of non-alphanumeric characters ("best-buy" ↔ "Best Buy").
 * A JS slug re-check disambiguates when the regex has multiple hits.
 *
 * When the same slug exists on multiple networks/regions, resolution is:
 *   1. region match for the requested `country` (region-specific stores),
 *   2. then the record carrying the most real (non-auto-generated) deals,
 *   3. then any deals, then a `joined` relationship — deterministic tiebreaks.
 * This keeps `/au/mybrainco` on the AU merchant (13 deals) instead of a
 * same-named US merchant that only has an auto-generated brand deal.
 */
async function getAdvertiserBySlugUncached(
  slug: string,
  country?: string,
): Promise<Advertiser | null> {
  let normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  // Handle old/existing slugs with -ww appended (e.g. invideo-ww -> invideo)
  if (normalized.endsWith("-ww")) {
    normalized = normalized.slice(0, -3).replace(/(^-|-$)/g, "");
  }

  return getCanonicalPublicStore(normalized, country);
}

/**
 * Find other advertisers sharing at least one category with the given store,
 * for a "Similar Stores" module. Region-filtered like the public listing so
 * a `/de/...` page doesn't cross-link to a US-only store.
 */
async function getRelatedAdvertisersUncached(
  categories: string[],
  exclude: { id: number; network: string },
  country?: string,
  limit = 6,
): Promise<Advertiser[]> {
  const cats = new Set(categories.map((c) => c.trim().toLowerCase()).filter(Boolean));
  if (!cats.size) return [];
  return (await getPublicStoreRecords(country?.toUpperCase())).filter((a) =>
    !(String(a.id) === String(exclude.id) && a.network === exclude.network) &&
    a.categories?.some((c) => cats.has(c.toLowerCase()))).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Public cached readers — served from Next's Data Cache (revalidated on a short
// window and busted by admin mutations via the "advertisers" tag).
// ---------------------------------------------------------------------------

/** Cached advertiser listing for public pages/APIs. */
export const getAdvertisersFromDb = unstable_cache(
  getAdvertisersFromDbUncached,
  ["public:advertisers-list"],
  { revalidate: PUBLIC_REVALIDATE, tags: [CACHE_TAGS.advertisers, CACHE_TAGS.deals] },
);

/** Cached showcase listing — lightweight, limited, for home page only. */
export const getShowcaseAdvertisersFromDb = unstable_cache(
  getShowcaseAdvertisersUncached,
  ["public:advertisers-showcase"],
  { revalidate: PUBLIC_REVALIDATE, tags: [CACHE_TAGS.advertisers, CACHE_TAGS.deals] },
);

/** Cached single-advertiser lookup by id. */
export const getAdvertiserByIdFromDb = unstable_cache(
  getAdvertiserByIdFromDbUncached,
  ["public:advertiser-by-id"],
  { revalidate: PUBLIC_REVALIDATE, tags: [CACHE_TAGS.advertisers] },
);

/** Cached advertiser lookup by slug (store pages). */
export const getAdvertiserBySlug = unstable_cache(
  getAdvertiserBySlugUncached,
  ["public:advertiser-by-slug"],
  { revalidate: PUBLIC_REVALIDATE, tags: [CACHE_TAGS.advertisers] },
);

/** Cached "similar stores" lookup by shared category. */
export const getRelatedAdvertisers = unstable_cache(
  getRelatedAdvertisersUncached,
  ["public:related-advertisers"],
  { revalidate: PUBLIC_REVALIDATE, tags: [CACHE_TAGS.advertisers] },
);

/**
 * Check if there is any data in the advertisers collection.
 */
export async function hasAdvertiserData(): Promise<boolean> {
  const db = await getDb();
  const col = db.collection(COLLECTION);
  const count = await col.estimatedDocumentCount();
  return count > 0;
}

/**
 * Remove advertisers that are no longer present in the API response
 * **for a specific network**. Called after upserting the fresh data — any
 * advertiser in that network whose `id` is NOT in `currentIds` gets deleted.
 *
 * @param currentIds IDs that are still valid for this network.
 * @param network The network to scope the removal to (e.g. "awin", "admitad").
 * @returns Number of documents removed.
 */
export async function removeStaleAdvertisers(
  currentIds: number[],
  network: string = "awin",
): Promise<number> {
  if (currentIds.length === 0) return 0;

  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  const result = await col.deleteMany({
    network,
    id: { $nin: currentIds },
    // Manually created advertisers are never present in any network feed, so
    // without this exclusion the next sync would delete every admin-added store.
    isManual: { $ne: true },
  });

  return result.deletedCount;
}

/**
 * One-time self-healing backfill: stamp `isManual: true` on admin-created
 * advertisers that predate the flag, so stale-removal no longer wipes them.
 *
 * Manual advertisers are assigned ids in the 900000+ band (`getNextAdvertiserId`),
 * which no network feed uses. Idempotent — only touches docs still missing
 * `isManual`, so it's a no-op once everything is marked.
 *
 * @returns Number of advertisers newly marked.
 */
export async function backfillManualAdvertisers(): Promise<number> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);
  const result = await col.updateMany(
    { id: { $gte: 900000 }, isManual: { $ne: true } },
    { $set: { isManual: true } },
  );
  return result.modifiedCount;
}

/**
 * Get the next available advertiser ID for newly created items.
 */
export async function getNextAdvertiserId(): Promise<number> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);
  const maxDoc = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const maxId = maxDoc.length > 0 ? maxDoc[0].id : 0;
  return Math.max(maxId + 1, 900000); // 900000+ range for custom created advertisers
}

/**
 * Create a new advertiser manually in MongoDB.
 */
export async function createAdvertiser(advertiser: Advertiser): Promise<Advertiser> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  await col.createIndex({ network: 1, id: 1 }, { unique: true });

  const doc: AdvertiserDoc = {
    ...advertiser,
    network: advertiser.network ?? "awin",
    // Mark as admin-created so the network sync's stale-removal never wipes it
    // (manual advertisers are, by definition, absent from every network feed).
    isManual: true,
    syncedAt: new Date(),
  };

  await col.updateOne(
    { network: doc.network, id: advertiser.id },
    { $set: doc },
    { upsert: true }
  );

  return { ...advertiser, isManual: true };
}

/**
 * Update an existing advertiser in MongoDB.
 */
export async function updateAdvertiser(
  id: number,
  data: Partial<Advertiser>,
  network?: string,
): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);
  const update = { $set: { ...data, syncedAt: new Date() } };

  const result = await col.updateOne({ id, ...(network ? { network } : {}) }, update);
  return result.matchedCount > 0;
}

/**
 * Delete an advertiser from MongoDB by ID.
 */
export async function deleteAdvertiser(
  id: number,
  network?: string,
): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  const result = await col.deleteOne({ id, ...(network ? { network } : {}) });
  return result.deletedCount > 0;
}

/** Public stores are unique by canonical slug. The directory also includes stores
 * without offers; offer listings retain their existing gate. Pagination follows deduplication. */
const loadPublicStoreRecords = singleFlight(async (key: string): Promise<Advertiser[]> => {
  const [country, requireDeals] = JSON.parse(key) as [string, boolean];
  const db = await getDb();
  const [docs, offerCounts] = await Promise.all([
    db.collection(COLLECTION).aggregate([
      { $match: { $and: [buildAdvertiserFilter({ country: country || undefined }), publicMerchantFilter()] } },
      { $set: { _publicMerchantName: merchantNameExpression("$name") } },
      { $project: { _id: 0 } },
    ], { maxTimeMS: 15_000 }).toArray(),
    db.collection(COLLECTION_DEALS).aggregate<{ _id: { network: string; merchant: string; name: string }; n: number }>(
      publicOfferCountStages(country || undefined), { maxTimeMS: 15_000 },
    ).toArray(),
  ]);
  const counts = new Map(offerCounts.map(({ _id, n }) => [publicMerchantCountKey(_id.network, _id.merchant, _id.name), n]));
  const unique = new Map<string, Advertiser>();
  for (const doc of docs) {
    const { _publicMerchantName, ...record } = doc;
    record.dealCount = counts.get(publicMerchantCountKey(record.network, record.id, _publicMerchantName)) ?? 0;
    const offerListingCandidate = record.dealCount > 0 || !!record.isFlagship;
    if (requireDeals && !offerListingCandidate) continue;
    const a = normalizeAdvertiserDoc(record);
    const slug = slugifyAdvertiserName(a.name);
    if (!slug) continue;
    const previous = unique.get(slug);
    // Keep the same merchant behind a link in both directory and offer listings.
    // A newly included empty record must not replace its published counterpart.
    const previousOfferListingCandidate = previous && ((previous.dealCount ?? 0) > 0 || !!previous.isFlagship);
    if (previous && offerListingCandidate !== previousOfferListingCandidate) {
      if (offerListingCandidate) unique.set(slug, a);
      continue;
    }
    const score = advertiserRegionScore(a, country);
    if (!previous || score > advertiserRegionScore(previous, country) ||
      (score === advertiserRegionScore(previous, country) && (a.dealCount ?? 0) > (previous.dealCount ?? 0))) unique.set(slug, a);
  }
  return [...unique.values()].sort((a, b) => Number(!!b.isFlagship) - Number(!!a.isFlagship) || a.name.localeCompare(b.name) || String(a.network).localeCompare(String(b.network)) || String(a.id).localeCompare(String(b.id)));
});

export const getPublicStoreRecords = unstable_cache(
  (country?: string, requireDeals = true) => loadPublicStoreRecords(JSON.stringify([country?.toUpperCase() ?? "", requireDeals])),
  ["public:eligible-store-records:v6"],
  { revalidate: PUBLIC_REVALIDATE, tags: [CACHE_TAGS.advertisers, CACHE_TAGS.deals] },
);

export async function getPublicAdvertisers(query: AdvertiserQuery & { network?: string; sortByOffers?: boolean }): Promise<PagedAdvertisers> {
  const search = query.search?.trim().toLowerCase();
  const category = query.category?.trim().toLowerCase();
  const stores = (await getPublicStoreRecords(query.country?.toUpperCase(), query.requireDeals !== false)).filter((a) =>
    (!search || a.name.toLowerCase().includes(search)) &&
    (!category || a.categories?.some((c) => c.toLowerCase() === category)) &&
    (!query.network || a.network === query.network));
  if (query.sortByOffers) stores.sort((a, b) => (b.dealCount ?? 0) - (a.dealCount ?? 0));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize || DEFAULT_PAGE_SIZE));
  const totalPages = Math.max(1, Math.ceil(stores.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, query.page || 1));
  return { advertisers: stores.slice((page - 1) * pageSize, page * pageSize), total: stores.length, totalPages, page, pageSize, facets: { regions: [], relationships: [], countries: [], categories: [] } };
}

export async function getCanonicalPublicStore(slug: string, country?: string): Promise<Advertiser | null> {
  return (await getPublicStoreRecords(country?.toUpperCase(), false)).find((a) => slugifyAdvertiserName(a.name) === slug) ?? null;
}
