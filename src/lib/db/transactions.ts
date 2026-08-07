/**
 * MongoDB persistence layer for Transactions.
 *
 * Stores the normalised `Transaction` type from `@/lib/transactions` with a
 * `syncedAt` timestamp. Provides bulk upsert (for cron sync) and
 * query/filter/sort/paginate (for the API route).
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

interface TransactionDoc extends Transaction {
  syncedAt: Date;
}

// ---------------------------------------------------------------------------
// Write — used by the cron sync job
// ---------------------------------------------------------------------------

/**
 * Upsert a batch of transactions into MongoDB.
 * Uses bulk `updateOne` with `upsert: true` keyed on transaction `id`.
 */
export async function upsertTransactions(
  transactions: Transaction[],
): Promise<{ upserted: number; modified: number }> {
  const db = await getDb();
  const col = db.collection<TransactionDoc>(COLLECTION);

  // Ensure indexes for common queries
  await Promise.all([
    col.createIndex({ id: 1 }, { unique: true }),
    col.createIndex({ transactionDate: -1 }),
    col.createIndex({ advertiserId: 1 }),
    col.createIndex({ status: 1 }),
  ]);

  const now = new Date();
  const ops = transactions.map((tx) => ({
    updateOne: {
      filter: { id: tx.id },
      update: { $setOnInsert: { ...tx, syncedAt: now } },
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
function buildFilter(query: TransactionQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

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
    filter.$or = [
      { advertiserName: { $regex: search, $options: "i" } },
      { id: isNaN(Number(search)) ? -1 : Number(search) },
    ];
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

  const [statuses, advertiserDocs] = await Promise.all([
    col.distinct("status", dateFilter),
    col
      .aggregate<{ _id: number; name: string }>([
        { $match: dateFilter },
        {
          $group: {
            _id: "$advertiserId",
            name: { $first: "$advertiserName" },
          },
        },
        { $sort: { name: 1 } },
      ])
      .toArray(),
  ]);

  return {
    statuses: (statuses as string[]).sort(),
    advertisers: advertiserDocs.map((d) => ({ id: d._id, name: d.name })),
  };
}

/**
 * Build sort specification from query parameters.
 */
function buildSort(
  query: TransactionQuery,
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
  query: TransactionQuery,
): Promise<PagedTransactions | null> {
  const db = await getDb();
  const col = db.collection<TransactionDoc>(COLLECTION);

  // If the collection is empty, return null so the caller falls back to Awin
  const count = await col.estimatedDocumentCount();
  if (count === 0) return null;

  const filter = buildFilter(query);

  // Facets use only the date filter so all statuses/advertisers are shown
  const dateFilter: Record<string, unknown> = {};
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

  const transactions = docs as unknown as Transaction[];

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
  query: TransactionQuery,
): Promise<Transaction[] | null> {
  const db = await getDb();
  const col = db.collection<TransactionDoc>(COLLECTION);

  const count = await col.estimatedDocumentCount();
  if (count === 0) return null;

  const filter = buildFilter(query);
  const sort = buildSort(query);

  const docs = await col
    .find(filter, { projection: { _id: 0, syncedAt: 0 } })
    .sort(sort)
    .toArray();

  return docs as unknown as Transaction[];
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
