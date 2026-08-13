/**
 * MongoDB persistence layer for Deals (promotions/offers).
 *
 * Stores the normalised `Deal` type from `@/lib/deals` with a
 * `syncedAt` timestamp. Provides bulk upsert (for cron sync) and
 * query/filter/paginate (for the API route).
 *
 * Multi-network: keyed on composite `(network, id)` to avoid ID collisions
 * between Awin and Admitad (or future networks).
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
 * Uses bulk `updateOne` with `upsert: true` keyed on `(network, id)`.
 */
export async function upsertDeals(
  deals: Deal[],
): Promise<{ upserted: number; modified: number }> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  // Ensure composite unique index for multi-network support
  await col.createIndex({ network: 1, id: 1 }, { unique: true });

  const now = new Date();
  const ops = deals.map((d) => ({
    updateOne: {
      filter: { network: d.network ?? "awin", id: d.id },
      update: { $setOnInsert: { ...d, network: d.network ?? "awin", syncedAt: now } },
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
function buildFilter(query: DealQuery & { network?: string }): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [];

  if (query.network) {
    conditions.push({ network: query.network });
  }

  if (query.search?.trim()) {
    const searchRegex = { $regex: query.search.trim(), $options: "i" };
    conditions.push({
      $or: [
        { title: searchRegex },
        { "advertiser.name": searchRegex },
        { description: searchRegex },
        { code: searchRegex },
      ],
    });
  }

  if (query.advertiserId) {
    conditions.push({ "advertiser.id": query.advertiserId });
  }

  if (query.status && query.status !== "all") {
    conditions.push({ status: query.status });
  }

  if (query.type && query.type !== "all") {
    conditions.push({ type: query.type });
  }

  if (query.country?.trim()) {
    const cc = query.country.trim().toUpperCase();
    conditions.push({
      $or: [
        { regionCodes: { $size: 0 } },
        { regionCodes: cc },
        { regionCodes: { $exists: false } },
      ],
    });
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}

/**
 * Query deals from MongoDB with filtering and pagination.
 * Returns the same `PagedDeals` shape the API route expects.
 */
export async function getDealsFromDb(
  query: DealQuery & { network?: string },
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
 * Remove deals that are no longer present in the API response
 * **for a specific network**. Called after upserting fresh data — any deal
 * in that network whose `id` is NOT in `currentIds` gets deleted.
 *
 * @param currentIds IDs that are still valid for this network.
 * @param network The network to scope the removal to (e.g. "awin", "admitad").
 * @returns Number of stale deals removed.
 */
export async function removeStaleDeals(
  currentIds: number[],
  network: string = "awin",
): Promise<number> {
  if (currentIds.length === 0) return 0;

  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  const result = await col.deleteMany({
    network,
    id: { $nin: currentIds },
  });

  return result.deletedCount;
}

/**
 * Get the next available deal ID for newly created items.
 */
export async function getNextDealId(): Promise<number> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);
  const maxDoc = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const maxId = maxDoc.length > 0 ? maxDoc[0].id : 0;
  return Math.max(maxId + 1, 900000); // 900000+ range for custom created deals
}

/**
 * Create a new deal in MongoDB.
 */
export async function createDeal(deal: Deal): Promise<Deal> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  await col.createIndex({ network: 1, id: 1 }, { unique: true });

  const doc: DealDoc = {
    ...deal,
    network: deal.network ?? "awin",
    syncedAt: new Date(),
  };

  await col.updateOne(
    { network: doc.network, id: deal.id },
    { $set: doc },
    { upsert: true }
  );

  return deal;
}

/**
 * Update an existing deal in MongoDB.
 */
export async function updateDeal(
  id: number,
  data: Partial<Deal>,
  network: string = "awin",
): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  const result = await col.updateOne(
    { network, id },
    { $set: { ...data, syncedAt: new Date() } }
  );

  return result.matchedCount > 0;
}

/**
 * Delete a deal from MongoDB by ID.
 */
export async function deleteDeal(
  id: number,
  network: string = "awin",
): Promise<boolean> {
  const db = await getDb();
  const col = db.collection<DealDoc>(COLLECTION);

  const result = await col.deleteOne({ network, id });
  return result.deletedCount > 0;
}
