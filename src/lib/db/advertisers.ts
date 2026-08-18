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
import { normalizeCountryCode, foreignCountrySignals } from "@/lib/countries";
import { cleanAdvertiserName } from "@/lib/networks";
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

interface AdvertiserDoc extends Advertiser {
  syncedAt: Date;
}

export function normalizeAdvertiserDoc(doc: any): Advertiser {
  if (!doc) return doc;
  if (doc.name) {
    doc.name = cleanAdvertiserName(doc.name);
  }
  doc.url = resolveAffiliateTrackingUrl(doc.network, doc.id, doc.url);
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
function buildFilter(query: AdvertiserQuery & { network?: string }): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  // Accumulate independent clauses here so that multiple filters (e.g. country
  // AND category) all apply — a single `filter.$or` would let a later clause
  // silently overwrite an earlier one.
  const and: Record<string, unknown>[] = [];

  if (query.network) {
    filter.network = query.network;
  }

  if (query.search?.trim()) {
    filter.name = { $regex: query.search.trim(), $options: "i" };
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
        { categories: { $elemMatch: { $regex: catRegex } } },
        { categories: cat },
      ],
    });
  }

  if (and.length > 0) {
    filter.$and = and;
  }

  return filter;
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
  query: AdvertiserQuery & { network?: string },
): Promise<PagedAdvertisers | null> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  // If the collection is empty, return null so the caller falls back to Awin
  const count = await col.estimatedDocumentCount();
  if (count === 0) return null;

  const filter = buildFilter(query);
  const facets = await getAdvertiserFacets();

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
          let: { advId: "$id", advNetwork: "$network" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$advertiser.id", "$$advId"] },
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
          let: { advId: "$id", advNetwork: "$network" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $or: [
                        { $eq: ["$advertiser.id", "$$advId"] },
                        { $eq: ["$advertiser.id", { $toString: "$$advId" }] },
                        { $eq: [{ $toString: "$advertiser.id" }, { $toString: "$$advId" }] },
                      ],
                    },
                    { $eq: ["$network", "$$advNetwork"] },
                  ],
                },
              },
            },
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
  const clean = cleanAdvertiserName(name || "");
  return clean
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolve a store slug (e.g. "amazon", "best-buy") to an advertiser.
 *
 * Advertisers have no dedicated slug field, so we match the slug against the
 * slugified `name` using a loose, anchored, case-insensitive regex where each
 * hyphen tolerates any run of non-alphanumeric characters ("best-buy" ↔ "Best Buy").
 * A JS slug re-check disambiguates when the regex has multiple hits.
 *
 * When multiple networks match, prefer the one with active deals, then the
 * first found (deterministic by sort order).
 */
async function getAdvertiserBySlugUncached(slug: string): Promise<Advertiser | null> {
  let normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  // Handle old/existing slugs with -ww appended (e.g. invideo-ww -> invideo)
  if (normalized.endsWith("-ww")) {
    normalized = normalized.slice(0, -3).replace(/(^-|-$)/g, "");
  }

  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  // Anchor the start and each slug part, but allow an optional TRAILING suffix
  // after the last part (e.g. "Beauty Amora AU", "Acme WW"). The suffix must
  // begin at a non-alphanumeric boundary, so this matches stripped country/region
  // tokens without over-matching mid-word extensions ("Amora" ≠ "Amorable").
  // Slugs are built from cleanAdvertiserName(), which removes those tokens, so
  // without this the cleaned slug could never resolve back to the raw DB name.
  const pattern =
    "^[^a-z0-9]*" +
    normalized
      .split("-")
      .map((part) => escapeRegExp(part))
      .join("[^a-z0-9]*") +
    "(?:[^a-z0-9].*)?$";

  let candidates = await col
    .find(
      { name: { $regex: pattern, $options: "i" } },
      { projection: { _id: 0, syncedAt: 0 } },
    )
    .limit(25)
    .toArray();

  if (candidates.length === 0) {
    const broader = await col
      .find(
        { name: { $regex: escapeRegExp(normalized), $options: "i" } },
        { projection: { _id: 0, syncedAt: 0 } },
      )
      .limit(25)
      .toArray();
    candidates = broader;
  }

  if (candidates.length === 0) return null;

  // Prefer an exact slug match; otherwise take the first regex candidate.
  const exact = candidates.find(
    (a) => slugifyAdvertiserName((a as unknown as Advertiser).name) === normalized,
  );

  const result = (exact ?? candidates[0]) as unknown as Advertiser;
  return normalizeAdvertiserDoc(result);
}

// ---------------------------------------------------------------------------
// Public cached readers — served from Next's Data Cache (revalidated on a short
// window and busted by admin mutations via the "advertisers" tag).
// ---------------------------------------------------------------------------

/** Cached advertiser listing for public pages/APIs. */
export const getAdvertisersFromDb = unstable_cache(
  getAdvertisersFromDbUncached,
  ["public:advertisers-list"],
  { revalidate: PUBLIC_REVALIDATE, tags: [CACHE_TAGS.advertisers] },
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
  });

  return result.deletedCount;
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
    syncedAt: new Date(),
  };

  await col.updateOne(
    { network: doc.network, id: advertiser.id },
    { $set: doc },
    { upsert: true }
  );

  return advertiser;
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

  // Prefer the exact (network, id) match; fall back to id-only so a
  // missing/stale network never causes the update to silently no-op.
  if (network) {
    const scoped = await col.updateOne({ network, id }, update);
    if (scoped.matchedCount > 0) return true;
  }

  const result = await col.updateOne({ id }, update);
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

  // Prefer the exact (network, id) match, but fall back to id-only so a
  // missing/stale network never causes the delete to silently no-op.
  if (network) {
    const scoped = await col.deleteOne({ network, id });
    if (scoped.deletedCount > 0) return true;
  }

  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}
