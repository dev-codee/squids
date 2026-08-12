/**
 * MongoDB persistence layer for Advertisers.
 *
 * Stores the normalised `Advertiser` type from `@/lib/awin` with a
 * `syncedAt` timestamp. Provides bulk upsert (for cron sync) and
 * query/filter/paginate (for the API route).
 */

import { getDb } from "@/lib/mongodb";
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

// ---------------------------------------------------------------------------
// Write — used by the cron sync job
// ---------------------------------------------------------------------------

/**
 * Upsert a batch of advertisers into MongoDB.
 * Uses bulk `updateOne` with `upsert: true` keyed on advertiser `id`.
 */
export async function upsertAdvertisers(
  advertisers: Advertiser[],
): Promise<{ upserted: number; modified: number }> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  // Ensure an index on `id` for fast lookups and upserts
  await col.createIndex({ id: 1 }, { unique: true });

  const now = new Date();
  const ops = advertisers.map((a) => ({
    updateOne: {
      filter: { id: a.id },
      update: { $setOnInsert: { ...a, syncedAt: now } },
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
function buildFilter(query: AdvertiserQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

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
    const cc = query.country.trim().toUpperCase();
    filter.$or = [
      { countryCode: cc },
      { isGlobal: true },
      { countryCode: { $in: ["WW", "GLOBAL", "INT"] } },
      { region: { $regex: /^(global|worldwide)$/i } },
    ];
  }

  return filter;
}

/**
 * Fetch facets (distinct regions, relationships, countries) from the full dataset.
 */
export async function getAdvertiserFacets(): Promise<AdvertiserFacets> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  const [regions, relationships, countries] = await Promise.all([
    col.distinct("region", { region: { $ne: null } }),
    col.distinct("relationship", { relationship: { $ne: null } }),
    col.distinct("countryCode", { countryCode: { $ne: null } }),
  ]);

  return {
    regions: (regions as string[]).sort(),
    relationships: (relationships as string[]).sort(),
    countries: (countries as string[]).map((c: string) => c.toUpperCase()).sort(),
  };
}

/**
 * Query advertisers from MongoDB with filtering and pagination.
 * Returns the same `PagedAdvertisers` shape the API route expects.
 */
export async function getAdvertisersFromDb(
  query: AdvertiserQuery,
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
          localField: "id",
          foreignField: "advertiser.id",
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
          localField: "id",
          foreignField: "advertiser.id",
          as: "activeDeals",
        },
      },
      { $match: { "activeDeals.0": { $exists: true } } },
      { $sort: { isFlagship: -1, name: 1 } },
      { $skip: skip },
      { $limit: pageSize },
      { $project: { _id: 0, syncedAt: 0, activeDeals: 0 } },
    ]).toArray();
  } else {
    docs = await col
      .find(filter, { projection: { _id: 0, syncedAt: 0 } })
      .sort({ isFlagship: -1, name: 1 })
      .skip(skip)
      .limit(pageSize)
      .toArray();
  }

  return {
    advertisers: docs as unknown as Advertiser[],
    page,
    pageSize,
    total,
    totalPages,
    facets,
  };
}

/**
 * Get a single advertiser by ID from MongoDB.
 */
export async function getAdvertiserByIdFromDb(id: number): Promise<Advertiser | null> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);
  const doc = await col.findOne({ id }, { projection: { _id: 0, syncedAt: 0 } });
  return (doc as unknown as Advertiser) || null;
}

/** Turn an advertiser name into a URL slug (lowercase, hyphenated). */
export function slugifyAdvertiserName(name: string): string {
  return name
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
 */
export async function getAdvertiserBySlug(slug: string): Promise<Advertiser | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  const pattern =
    "^[^a-z0-9]*" +
    normalized
      .split("-")
      .map((part) => escapeRegExp(part))
      .join("[^a-z0-9]*") +
    "[^a-z0-9]*$";

  const candidates = await col
    .find(
      { name: { $regex: pattern, $options: "i" } },
      { projection: { _id: 0, syncedAt: 0 } },
    )
    .limit(25)
    .toArray();

  if (candidates.length === 0) return null;

  // Prefer an exact slug match; otherwise take the first regex candidate.
  const exact = candidates.find(
    (a) => slugifyAdvertiserName((a as unknown as Advertiser).name) === normalized,
  );
  return (exact ?? candidates[0]) as unknown as Advertiser;
}

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
 * Remove advertisers that are no longer present in the Awin API response.
 * Called after upserting the fresh data — any advertiser whose `id` is NOT
 * in `currentIds` gets deleted (e.g. relationship changed to "not joined").
 *
 * @returns Number of documents removed.
 */
export async function removeStaleAdvertisers(
  currentIds: number[],
): Promise<number> {
  if (currentIds.length === 0) return 0;

  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  const result = await col.deleteMany({
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

  await col.createIndex({ id: 1 }, { unique: true });

  const doc: AdvertiserDoc = {
    ...advertiser,
    syncedAt: new Date(),
  };

  await col.updateOne(
    { id: advertiser.id },
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
): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  const result = await col.updateOne(
    { id },
    { $set: { ...data, syncedAt: new Date() } }
  );

  return result.matchedCount > 0;
}

/**
 * Delete an advertiser from MongoDB by ID.
 */
export async function deleteAdvertiser(id: number): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<AdvertiserDoc>(COLLECTION);

  const result = await col.deleteOne({ id });
  return result.deletedCount > 0;
}

