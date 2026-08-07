/**
 * MongoDB persistence layer for Deals (promotions/offers).
 *
 * Stores the normalised `Deal` type from `@/lib/deals` with a
 * `syncedAt` timestamp. Provides bulk upsert (for cron sync) and
 * query/filter/paginate (for the API route).
 */

import { getDb } from "@/lib/mongodb";
import type { Deal, DealQuery, PagedDeals } from "@/lib/deals";
import { DEFAULT_DEALS_PAGE_SIZE, MAX_DEALS_PAGE_SIZE } from "@/lib/deals";

const COLLECTION = "deals";

interface DealDoc extends Deal {
  syncedAt: Date;
}

// ---------------------------------------------------------------------------
// Write — used by the cron sync job
// ---------------------------------------------------------------------------

/**
 * Upsert a batch of deals into MongoDB.
 * Uses bulk `updateOne` with `upsert: true` keyed on deal `id`.
 */
export async function upsertDeals(
  deals: Deal[],
): Promise<{ upserted: number; modified: number }> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  // Ensure an index on `id` for fast lookups and upserts
  await col.createIndex({ id: 1 }, { unique: true });

  const now = new Date();
  const ops = deals.map((d) => ({
    updateOne: {
      filter: { id: d.id },
      update: { $set: { ...d, syncedAt: now } },
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
function buildFilter(query: DealQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.search?.trim()) {
    // Search across title, advertiser name, and description
    filter.$or = [
      { title: { $regex: query.search.trim(), $options: "i" } },
      { "advertiser.name": { $regex: query.search.trim(), $options: "i" } },
      { description: { $regex: query.search.trim(), $options: "i" } },
    ];
  }
  if (query.advertiserId) {
    filter["advertiser.id"] = query.advertiserId;
  }
  if (query.status && query.status !== "all") {
    filter.status = query.status;
  }
  if (query.type && query.type !== "all") {
    filter.type = query.type;
  }
  if (query.country?.trim()) {
    filter.regionCodes = query.country.trim().toUpperCase();
  }

  return filter;
}

/**
 * Query deals from MongoDB with filtering and pagination.
 * Returns the same `PagedDeals` shape the API route expects.
 */
export async function getDealsFromDb(
  query: DealQuery,
): Promise<PagedDeals | null> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  // If the collection is empty, return null so the caller falls back to Awin
  const count = await col.estimatedDocumentCount();
  if (count === 0) return null;

  const filter = buildFilter(query);

  const pageSize = Math.min(
    Math.max(1, query.pageSize || DEFAULT_DEALS_PAGE_SIZE),
    MAX_DEALS_PAGE_SIZE,
  );
  const total = await col.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page || 1), totalPages);
  const skip = (page - 1) * pageSize;

  const docs = await col
    .find(filter, { projection: { _id: 0, syncedAt: 0 } })
    .sort({ "advertiser.name": 1, title: 1 })
    .skip(skip)
    .limit(pageSize)
    .toArray();

  return {
    deals: docs as unknown as Deal[],
    page,
    pageSize,
    total,
    totalPages,
  };
}

/**
 * Check if there is any data in the deals collection.
 */
export async function hasDealsData(): Promise<boolean> {
  const db = await getDb();
  const col = db.collection(COLLECTION);
  const count = await col.estimatedDocumentCount();
  return count > 0;
}

/**
 * Remove deals whose `endDate` has passed.
 * Deals with no `endDate` are kept (they're open-ended promotions).
 *
 * @returns Number of expired deals removed.
 */
export async function removeExpiredDeals(): Promise<number> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  const now = new Date().toISOString();

  const result = await col.deleteMany({
    endDate: { $ne: null, $lt: now },
  });

  return result.deletedCount;
}

/**
 * Remove deals that are no longer present in the Awin API response.
 * Called after upserting fresh data — any deal whose `id` is NOT in
 * `currentIds` gets deleted (e.g. advertiser removed the promotion).
 *
 * @returns Number of stale deals removed.
 */
export async function removeStaleDeals(
  currentIds: number[],
): Promise<number> {
  if (currentIds.length === 0) return 0;

  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  const result = await col.deleteMany({
    id: { $nin: currentIds },
  });

  return result.deletedCount;
}
