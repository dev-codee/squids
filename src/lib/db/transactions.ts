/**
 * MongoDB persistence layer for Transactions.
 *
 * Stores the normalised `Transaction` type from `@/lib/transactions` with a
 * `syncedAt` timestamp. Provides bulk upsert (for cron sync) and
 * query/filter/sort/paginate (for the API route).
 *
 * Multi-network: keyed on composite `(network, id)` to avoid ID collisions
 * between Awin and Admitad (or future networks).
 */

import { getDb } from "@/lib/mongodb";
import type {
  Transaction,
  TransactionQuery,
  TransactionSummary,
  TransactionFacets,
  PagedTransactions,
} from "@/lib/transactions";
import { buildSummary } from "@/lib/transactions";

const COLLECTION = "transactions";
const ADVERTISERS_COLLECTION = "advertisers";

interface TransactionDoc extends Transaction {
  syncedAt: Date;
}

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Awin's transaction feed doesn't include the advertiser's name (only its id),
 * so we resolve names from the synced `advertisers` collection at read time.
 * This repairs both legacy rows (which stored our publisher site name) and any
 * future rows without needing to re-sync.
 *
 * For Admitad, the campaign name is stored directly on the transaction, so this
 * lookup only enriches entries that don't already have a meaningful name.
 */
async function buildAdvertiserNameMap(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const uniqueIds = Array.from(new Set(ids)).filter((id) => Number.isFinite(id));
  if (uniqueIds.length === 0) return map;

  const db = await getDb();
  const docs = await db
    .collection(ADVERTISERS_COLLECTION)
    .find({ id: { $in: uniqueIds } }, { projection: { _id: 0, id: 1, name: 1 } })
    .toArray();

  for (const d of docs) {
    if (d && typeof d.name === "string" && d.name.trim()) {
      map.set(d.id as number, d.name);
    }
  }
  return map;
}

/** Overlay resolved advertiser names onto a batch of transactions. */
function applyAdvertiserNames(
  transactions: Transaction[],
  nameMap: Map<number, string>,
): Transaction[] {
  return transactions.map((tx) => ({
    ...tx,
    advertiserName: nameMap.get(tx.advertiserId) ?? tx.advertiserName ?? `Advertiser #${tx.advertiserId}`,
  }));
}

/** Advertiser ids whose (real) name matches a search term. */
async function resolveAdvertiserIdsByName(search: string): Promise<number[]> {
  const db = await getDb();
  const docs = await db
    .collection(ADVERTISERS_COLLECTION)
    .find(
      { name: { $regex: escapeRegExp(search), $options: "i" } },
      { projection: { _id: 0, id: 1 } },
    )
    .toArray();
  return docs.map((d) => d.id as number);
}

// ---------------------------------------------------------------------------
// Write — used by the cron sync job
// ---------------------------------------------------------------------------

/**
 * Upsert a batch of transactions into MongoDB.
 * Uses bulk `updateOne` with `upsert: true` keyed on `(network, id)`.
 */
export async function upsertTransactions(
  transactions: Transaction[],
): Promise<{ upserted: number; modified: number }> {
  const db = await getDb();
  const col = db.collection<TransactionDoc>(COLLECTION);

  // Ensure indexes for common queries
  await Promise.all([
    col.createIndex({ network: 1, id: 1 }, { unique: true }),
    col.createIndex({ transactionDate: -1 }),
    col.createIndex({ advertiserId: 1 }),
    col.createIndex({ status: 1 }),
    col.createIndex({ network: 1 }),
  ]);

  const now = new Date();
  const ops = transactions.map((tx) => ({
    updateOne: {
      filter: { network: tx.network ?? "awin", id: tx.id },
      update: { $setOnInsert: { ...tx, network: tx.network ?? "awin", syncedAt: now } },
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

/** Extended query type with optional network filter. */
type NetworkTransactionQuery = TransactionQuery & { network?: string };

/**
 * Build MongoDB filter from the query parameters.
 */
function buildFilter(
  query: NetworkTransactionQuery,
  searchAdvertiserIds: number[] = [],
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.network) {
    filter.network = query.network;
  }

  // Date range filter
  if (query.startDate || query.endDate) {
    const dateFilter: Record<string, string> = {};
    if (query.startDate) dateFilter.$gte = query.startDate;
    if (query.endDate) dateFilter.$lte = query.endDate;
    filter.transactionDate = dateFilter;
  }

  if (query.status) {
    filter.status = query.status;
  }
  if (query.advertiserId) {
    filter.advertiserId = Number(query.advertiserId);
  }
  if (query.search?.trim()) {
    const search = query.search.trim();
    const numeric = Number(search);
    const or: Record<string, unknown>[] = [
      // Legacy stored name (may still hold a URL) — kept for completeness.
      { advertiserName: { $regex: escapeRegExp(search), $options: "i" } },
    ];
    if (!isNaN(numeric)) {
      or.push({ id: numeric }, { advertiserId: numeric });
    }
    // Match against real advertiser names resolved from the advertisers collection.
    if (searchAdvertiserIds.length > 0) {
      or.push({ advertiserId: { $in: searchAdvertiserIds } });
    }
    filter.$or = or;
  }

  return filter;
}

/**
 * Build facets (distinct statuses and advertisers) from the filtered dataset.
 */
async function getFacets(
  dateFilter: Record<string, unknown>,
): Promise<TransactionFacets> {
  const db = await getDb();
  const col = db.collection<TransactionDoc>(COLLECTION);

  const [statuses, advertiserIds] = await Promise.all([
    col.distinct("status", dateFilter),
    col.distinct("advertiserId", dateFilter),
  ]);

  // Resolve real advertiser names (Awin transactions carry only the id).
  const nameMap = await buildAdvertiserNameMap(advertiserIds as number[]);
  const advertisers = (advertiserIds as number[])
    .map((id) => ({ id, name: nameMap.get(id) ?? `Advertiser #${id}` }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    statuses: (statuses as string[]).sort(),
    advertisers,
  };
}

/**
 * Build sort specification from query parameters.
 */
function buildSort(
  query: NetworkTransactionQuery,
): Record<string, 1 | -1> {
  const sortBy = query.sortBy || "transactionDate";
  const sortDir = query.sortDir === "asc" ? 1 : -1;
  return { [sortBy]: sortDir };
}

/**
 * Query transactions from MongoDB with filtering, sorting, and pagination.
 * Returns the same `PagedTransactions` shape the API route expects.
 */
export async function getTransactionsFromDb(
  query: NetworkTransactionQuery,
): Promise<PagedTransactions | null> {
  const db = await getDb();
  const col = db.collection<TransactionDoc>(COLLECTION);

  // If the collection is empty, return null so the caller falls back to Awin
  const count = await col.estimatedDocumentCount();
  if (count === 0) return null;

  // Resolve advertiser ids matching a name search so the search box works
  // against the real advertiser names, not the (legacy) stored value.
  const searchAdvertiserIds = query.search?.trim()
    ? await resolveAdvertiserIdsByName(query.search.trim())
    : [];
  const filter = buildFilter(query, searchAdvertiserIds);

  // Facets use only the date filter so all statuses/advertisers are shown
  const dateFilter: Record<string, unknown> = {};
  if (query.network) dateFilter.network = query.network;
  if (query.startDate || query.endDate) {
    const df: Record<string, string> = {};
    if (query.startDate) df.$gte = query.startDate;
    if (query.endDate) df.$lte = query.endDate;
    dateFilter.transactionDate = df;
  }

  const [facets, total] = await Promise.all([
    getFacets(dateFilter),
    col.countDocuments(filter),
  ]);

  const DEFAULT_PAGE_SIZE = 20;
  const MAX_PAGE_SIZE = 100;

  const pageSize = Math.min(
    Math.max(1, query.pageSize || DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page || 1), totalPages);
  const skip = (page - 1) * pageSize;

  const sort = buildSort(query);

  const docs = await col
    .find(filter, { projection: { _id: 0, syncedAt: 0 } })
    .sort(sort)
    .skip(skip)
    .limit(pageSize)
    .toArray();

  // Overlay real advertiser names (Awin transactions store only the id;
  // Admitad transactions may already have a name — applyAdvertiserNames
  // preserves the existing name if the lookup misses).
  const nameMap = await buildAdvertiserNameMap(
    docs.map((d) => (d as unknown as Transaction).advertiserId),
  );
  const transactions = applyAdvertiserNames(
    docs as unknown as Transaction[],
    nameMap,
  );

  // Build summary from ALL matching transactions (not just the page)
  // For performance, we aggregate in MongoDB
  const summaryPipeline = [
    { $match: filter },
    {
      $group: {
        _id: null,
        totalCommission: { $sum: "$commission" },
        totalTransactions: { $sum: 1 },
        pendingCount: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
        approvedCount: {
          $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
        },
        declinedCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ["$status", "declined"] },
                  { $eq: ["$status", "deleted"] },
                ],
              },
              1,
              0,
            ],
          },
        },
        totalOrderValue: { $sum: "$orderValue" },
        currency: { $first: "$commissionCurrency" },
      },
    },
  ];

  const [summaryResult] = await col.aggregate(summaryPipeline).toArray();

  const summary: TransactionSummary = summaryResult
    ? {
        totalCommission:
          Math.round((summaryResult.totalCommission as number) * 100) / 100,
        totalTransactions: summaryResult.totalTransactions as number,
        pendingCount: summaryResult.pendingCount as number,
        approvedCount: summaryResult.approvedCount as number,
        declinedCount: summaryResult.declinedCount as number,
        avgOrderValue:
          (summaryResult.totalTransactions as number) > 0
            ? Math.round(
                ((summaryResult.totalOrderValue as number) /
                  (summaryResult.totalTransactions as number)) *
                  100,
              ) / 100
            : 0,
        currency: (summaryResult.currency as string) || "USD",
      }
    : {
        totalCommission: 0,
        totalTransactions: 0,
        pendingCount: 0,
        approvedCount: 0,
        declinedCount: 0,
        avgOrderValue: 0,
        currency: "USD",
      };

  return {
    transactions,
    summary,
    page,
    pageSize,
    total,
    totalPages,
    facets,
  };
}

/**
 * Get all transactions in a date range (for CSV export).
 */
export async function getAllTransactionsFromDb(
  query: NetworkTransactionQuery,
): Promise<Transaction[] | null> {
  const db = await getDb();
  const col = db.collection<TransactionDoc>(COLLECTION);

  const count = await col.estimatedDocumentCount();
  if (count === 0) return null;

  const searchAdvertiserIds = query.search?.trim()
    ? await resolveAdvertiserIdsByName(query.search.trim())
    : [];
  const filter = buildFilter(query, searchAdvertiserIds);
  const sort = buildSort(query);

  const docs = await col
    .find(filter, { projection: { _id: 0, syncedAt: 0 } })
    .sort(sort)
    .toArray();

  const nameMap = await buildAdvertiserNameMap(
    docs.map((d) => (d as unknown as Transaction).advertiserId),
  );
  return applyAdvertiserNames(docs as unknown as Transaction[], nameMap);
}

/**
 * Check if there is any data in the transactions collection.
 */
export async function hasTransactionData(): Promise<boolean> {
  const db = await getDb();
  const col = db.collection(COLLECTION);
  const count = await col.estimatedDocumentCount();
  return count > 0;
}
