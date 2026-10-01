/**
 * MongoDB persistence layer for Activity & Audit Logs.
 *
 * Tracks system events, background cron sync executions, newly joined stores,
 * added/updated deals, deletions, and errors.
 */

import { getDb } from "@/lib/mongodb";
import type { ObjectId } from "mongodb";

const COLLECTION = "activity_logs";

export type ActivityType =
  | "cron_sync"
  | "store_joined"
  | "deal_added"
  | "deal_deleted"
  | "store_updated"
  | "store_deleted"
  | "manual_sync"
  | "system";

export type ActivityStatus = "success" | "warning" | "error" | "info";

export interface ActivityLogInput {
  type: ActivityType;
  title: string;
  description: string;
  network?: string;
  entity?: string;
  stats?: {
    created?: number;
    updated?: number;
    deleted?: number;
    total?: number;
  };
  status: ActivityStatus;
  metadata?: Record<string, unknown>;
}

export interface ActivityLogDoc extends ActivityLogInput {
  _id?: ObjectId | string;
  timestamp: Date;
}

export interface ActivityLogQuery {
  page?: number;
  pageSize?: number;
  type?: string;
  network?: string;
  search?: string;
  status?: string;
}

/**
 * Record an activity event in MongoDB.
 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    const db = await getDb();
    const col = db.collection<ActivityLogDoc>(COLLECTION);

    // Create index on timestamp for fast chronological queries
    await col.createIndex({ timestamp: -1 });
    await col.createIndex({ type: 1, timestamp: -1 });
    await col.createIndex({ network: 1, timestamp: -1 });

    await col.insertOne({
      ...input,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("[activity-logs] Failed to log activity:", err);
  }
}

/**
 * Fetch paginated activity logs with optional filtering.
 */
export async function getActivityLogs(query: ActivityLogQuery = {}) {
  const db = await getDb();
  const col = db.collection<ActivityLogDoc>(COLLECTION);

  const filter: Record<string, unknown> = {};

  if (query.type && query.type !== "all") {
    filter.type = query.type;
  }

  if (query.network && query.network !== "all") {
    filter.network = query.network.toLowerCase();
  }

  if (query.status && query.status !== "all") {
    filter.status = query.status;
  }

  if (query.search?.trim()) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [
      { title: regex },
      { description: regex },
      { network: regex },
      { entity: regex },
    ];
  }

  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
  const skip = (page - 1) * pageSize;

  const total = await col.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const items = await col
    .find(filter)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(pageSize)
    .toArray();

  const formatted = items.map((doc) => ({
    ...doc,
    _id: String(doc._id),
  }));

  return {
    items: formatted,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Calculate high-level metrics for dashboard cards.
 */
export async function getActivitySummary() {
  const db = await getDb();
  const logsCol = db.collection<ActivityLogDoc>(COLLECTION);
  const advCol = db.collection("advertisers");
  const dealsCol = db.collection("deals");

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalLogs,
    errorLogs24h,
    storesJoined7d,
    dealsAdded24h,
    lastSyncDoc,
  ] = await Promise.all([
    logsCol.countDocuments(),
    logsCol.countDocuments({
      status: "error",
      timestamp: { $gte: twentyFourHoursAgo },
    }),
    advCol.countDocuments({
      syncedAt: { $gte: sevenDaysAgo },
    }),
    dealsCol.countDocuments({
      syncedAt: { $gte: twentyFourHoursAgo },
    }),
    logsCol.findOne({ type: "cron_sync" }, { sort: { timestamp: -1 } }),
  ]);

  return {
    totalLogs,
    errorLogs24h,
    storesJoined7d,
    dealsAdded24h,
    lastSyncAt: lastSyncDoc?.timestamp ?? null,
    lastSyncStatus: lastSyncDoc?.status ?? null,
  };
}
